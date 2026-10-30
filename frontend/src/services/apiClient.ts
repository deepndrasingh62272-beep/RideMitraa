import axios, {
  AxiosInstance,
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_BASE_URL } from '../apiConstants';
import { isRetryableError } from './errorHandler';
import { logError, logInfo, logDebug } from './errorLogger';

// ─── Configuration ──────────────────────────────────────────────────────────

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 30_000,           // 30 seconds
  maxRetries: 3,
  retryBaseDelay: 1_000,     // 1 second — grows with exponential backoff
  retryMaxDelay: 15_000,     // 15 seconds cap
} as const;

// ─── Retry Metadata ─────────────────────────────────────────────────────────

interface RetryConfig {
  __retryCount?: number;
  __skipRetry?: boolean;
}

type RequestConfigWithRetry = InternalAxiosRequestConfig & RetryConfig;

// ─── Auth Event System ──────────────────────────────────────────────────────

type AuthEventType = 'logout';
type AuthEventListener = () => void;

const authListeners: Map<AuthEventType, Set<AuthEventListener>> = new Map();

export const onAuthEvent = (event: AuthEventType, listener: AuthEventListener): (() => void) => {
  if (!authListeners.has(event)) {
    authListeners.set(event, new Set());
  }
  authListeners.get(event)!.add(listener);
  return () => authListeners.get(event)?.delete(listener);
};

const emitAuthEvent = (event: AuthEventType) => {
  authListeners.get(event)?.forEach((fn) => {
    try { fn(); } catch (e) { console.error('[apiClient] Auth listener error:', e); }
  });
};

// ─── Create Axios Instance ──────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor ────────────────────────────────────────────────────

apiClient.interceptors.request.use(
  (config) => {
    // Attach auth token
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    // Initialize retry counter
    (config as RequestConfigWithRetry).__retryCount =
      (config as RequestConfigWithRetry).__retryCount ?? 0;

    // Never retry auth/me or users/me — called on every mount, retrying causes 429 spam
    // Never retry file uploads — partial uploads cause data corruption and 500s
    const url = config.url || '';
    if (
      url.includes('/auth/me') ||
      url.includes('/auth/refresh') ||
      url.includes('/users/me') ||
      url.includes('/photo') ||
      url.includes('/kyc/')
    ) {
      (config as RequestConfigWithRetry).__skipRetry = true;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ───────────────────────────────────────────────────

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    logDebug('apiClient', 'response', `${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as RequestConfigWithRetry | undefined;
    const method = config?.method?.toUpperCase() || 'UNKNOWN';
    const url = config?.url || 'UNKNOWN';
    const status = error.response?.status || 'NO_STATUS';

    logError('apiClient', 'response', `${method} ${url} failed with status ${status}`, error, {
      status,
      method,
      url,
      retryCount: config?.__retryCount,
    });

    // ── Handle 401 Unauthorized ─────────────────────────────────────────
    if (error.response?.status === 401) {
      logInfo('apiClient', 'response', 'Unauthorized (401) - logging out user');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // Emit logout event so AuthContext can react
        emitAuthEvent('logout');

        // Redirect only if not on login page
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
      }
      return Promise.reject(error);
    }

    // ── 429 Too Many Requests — do NOT retry, just reject ───────────────
    if (error.response?.status === 429) {
      logError('apiClient', 'response', `Rate limited (429) on ${method} ${url} — not retrying`, error);
      return Promise.reject(error);
    }

    // ── Auto-Retry Logic ────────────────────────────────────────────────
    if (config && !config.__skipRetry && isRetryableError(error)) {
      const retryCount = config.__retryCount ?? 0;

      if (retryCount < API_CONFIG.maxRetries) {
        config.__retryCount = retryCount + 1;

        // Exponential backoff with jitter
        const baseDelay = API_CONFIG.retryBaseDelay * Math.pow(2, retryCount);
        const jitter = baseDelay * 0.2 * Math.random(); // ±20% jitter
        const delay = Math.min(baseDelay + jitter, API_CONFIG.retryMaxDelay);

        logInfo('apiClient', 'response', `Retrying ${retryCount + 1}/${API_CONFIG.maxRetries}`, {
          method,
          url,
          delay: Math.round(delay),
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
        return apiClient(config);
      } else {
        logError('apiClient', 'response', `Max retries (${API_CONFIG.maxRetries}) exceeded`, error, {
          method,
          url,
        });
      }
    }

    return Promise.reject(error);
  }
);

// ─── Utility: Manual Retry ──────────────────────────────────────────────────

export const retryRequest = async <T>(
  fn: () => Promise<AxiosResponse<T>>,
  maxRetries = API_CONFIG.maxRetries,
  baseDelay = API_CONFIG.retryBaseDelay
): Promise<AxiosResponse<T>> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fn();
      if (attempt > 0) {
        logInfo('apiClient', 'retryRequest', `Request succeeded after ${attempt} retries`);
      }
      return response;
    } catch (error) {
      lastError = error;

      // Never retry 429 (rate limit) — backing off makes it worse
      const status = (error as any)?.response?.status;
      if (status === 429) {
        logError('apiClient', 'retryRequest', `Rate limited (429) — not retrying`, error);
        throw error;
      }

      if (attempt < maxRetries && isRetryableError(error)) {
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt) + baseDelay * 0.2 * Math.random(),
          API_CONFIG.retryMaxDelay
        );
        logInfo('apiClient', 'retryRequest', `Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`, {
          error: (error as any)?.message,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logError('apiClient', 'retryRequest', `Request failed after ${attempt} attempts`, error);
        throw error;
      }
    }
  }

  throw lastError;
};

// ─── Utility: Skip Retry for Specific Calls ─────────────────────────────────

export const noRetry = (config: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...config,
  __skipRetry: true,
});

export default apiClient;
