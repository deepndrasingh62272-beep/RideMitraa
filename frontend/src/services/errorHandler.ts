import { AxiosError } from 'axios';

// ─── Error Types ─────────────────────────────────────────────────────────────

export interface ApiError {
  message: string;
  userMessage: string;       // User-friendly message to display
  code: string;
  status: number;
  details?: unknown;
  isRetryable: boolean;
  timestamp: number;
  requestId?: string;
}

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorEvent {
  error: ApiError;
  severity: ErrorSeverity;
  context?: string;          // e.g., 'booking', 'payment', 'auth'
}

// ─── User-Friendly Message Map ──────────────────────────────────────────────

const USER_FRIENDLY_MESSAGES: Record<number | string, string> = {
  // HTTP Status Codes
  400: 'Something doesn\'t look right. Please check your input and try again.',
  401: 'Your session has expired. Please log in again.',
  403: 'You don\'t have permission to do this.',
  404: 'We couldn\'t find what you\'re looking for.',
  408: 'The request took too long. Please try again.',
  409: 'This action conflicts with something else. Please refresh and try again.',
  422: 'Some of the information provided is invalid. Please review and try again.',
  429: 'You\'re doing that too fast. Please wait a moment and try again.',
  500: 'Something went wrong on our end. We\'re working on it!',
  502: 'Our servers are temporarily unavailable. Please try again shortly.',
  503: 'Service is temporarily down for maintenance. Please try again later.',
  504: 'The server took too long to respond. Please try again.',

  // Custom Error Codes
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  TIMEOUT: 'The request timed out. Please check your connection and try again.',
  CANCELLED: 'The request was cancelled.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

// ─── Context-Specific Messages ──────────────────────────────────────────────

const CONTEXT_MESSAGES: Record<string, Record<number, string>> = {
  auth: {
    401: 'Invalid credentials. Please check your email and password.',
    403: 'Your account has been suspended. Please contact support.',
    429: 'Too many login attempts. Please wait a few minutes before trying again.',
  },
  booking: {
    404: 'This ride is no longer available.',
    409: 'Someone already booked the last seat. Try another ride!',
    422: 'Unable to process booking. Please check the ride details.',
  },
  payment: {
    400: 'Payment details are incorrect. Please verify and try again.',
    402: 'Insufficient funds. Please top up your wallet.',
    409: 'This payment has already been processed.',
  },
  ride: {
    404: 'This ride has been cancelled or doesn\'t exist.',
    409: 'This ride has already started or ended.',
    422: 'Invalid ride details. Please check pickup and drop locations.',
  },
  chat: {
    404: 'This conversation is no longer available.',
    429: 'You\'re sending messages too quickly. Please slow down.',
  },
};

// ─── Error Listeners ────────────────────────────────────────────────────────

type ErrorListener = (event: ErrorEvent) => void;
const errorListeners: Set<ErrorListener> = new Set();

export const addErrorListener = (listener: ErrorListener): (() => void) => {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
};

const notifyListeners = (event: ErrorEvent): void => {
  errorListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (e) {
      console.error('[ErrorHandler] Listener threw an error:', e);
    }
  });
};

// ─── Error Severity ─────────────────────────────────────────────────────────

const getSeverity = (status: number): ErrorSeverity => {
  if (status === 0) return 'warning';    // Network error
  if (status === 401) return 'warning';  // Auth — handled gracefully
  if (status === 429) return 'warning';  // Rate limit
  if (status >= 500) return 'critical';  // Server errors
  if (status >= 400) return 'error';     // Client errors
  return 'info';
};

// ─── Core: Parse Error ──────────────────────────────────────────────────────

export const parseError = (error: unknown, context?: string): ApiError => {
  const timestamp = Date.now();

  // Handle null/undefined/empty
  if (!error || (typeof error === 'object' && Object.keys(error as object).length === 0)) {
    return {
      message: 'Network error',
      userMessage: USER_FRIENDLY_MESSAGES.NETWORK_ERROR,
      code: 'NETWORK_ERROR',
      status: 0,
      isRetryable: true,
      timestamp,
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      userMessage: error,
      code: 'UNKNOWN',
      status: 0,
      isRetryable: false,
      timestamp,
    };
  }

  // Handle ApiError (already parsed)
  if (isApiError(error)) {
    return error;
  }

  // Handle Axios errors
  if (isAxiosError(error)) {
    return parseAxiosError(error, context, timestamp);
  }

  // Handle native Error
  if (error instanceof Error) {
    const isNetwork = error.message.toLowerCase().includes('network') ||
                      error.message.toLowerCase().includes('fetch');
    return {
      message: error.message,
      userMessage: isNetwork ? USER_FRIENDLY_MESSAGES.NETWORK_ERROR : error.message,
      code: isNetwork ? 'NETWORK_ERROR' : 'UNKNOWN',
      status: 0,
      isRetryable: isNetwork,
      timestamp,
    };
  }

  // Fallback
  return {
    message: String(error),
    userMessage: USER_FRIENDLY_MESSAGES.UNKNOWN,
    code: 'UNKNOWN',
    status: 0,
    isRetryable: false,
    timestamp,
  };
};

// ─── Axios-Specific Parser ──────────────────────────────────────────────────

const parseAxiosError = (
  error: AxiosError<any>,
  context?: string,
  timestamp = Date.now()
): ApiError => {
  // No response — network/timeout error
  if (!error.response) {
    const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
    return {
      message: error.message || 'Network error',
      userMessage: isTimeout ? USER_FRIENDLY_MESSAGES.TIMEOUT : USER_FRIENDLY_MESSAGES.NETWORK_ERROR,
      code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      status: 0,
      isRetryable: true,
      timestamp,
    };
  }

  const { status, data } = error.response;
  const serverMessage = data?.message || data?.error || error.message;

  // Build user-friendly message with context priority
  let userMessage = USER_FRIENDLY_MESSAGES[status] || USER_FRIENDLY_MESSAGES.UNKNOWN;
  if (context && CONTEXT_MESSAGES[context]?.[status]) {
    userMessage = CONTEXT_MESSAGES[context][status];
  }

  // For 400-level errors, prefer the server message if it's descriptive enough
  if (status >= 400 && status < 500 && serverMessage && serverMessage.length > 10) {
    userMessage = serverMessage;
  }

  const requestId = (error.response.headers?.['x-request-id'] as string) || undefined;

  return {
    message: serverMessage || `HTTP ${status}`,
    userMessage,
    code: mapStatusToCode(status),
    status,
    details: data?.details,
    isRetryable: status >= 500 || status === 429 || status === 408,
    timestamp,
    requestId,
  };
};

// ─── Status Code to Error Code Map ──────────────────────────────────────────

const mapStatusToCode = (status: number): string => {
  const codeMap: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    408: 'TIMEOUT',
    409: 'CONFLICT',
    422: 'VALIDATION_ERROR',
    429: 'RATE_LIMIT',
    500: 'SERVER_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT',
  };
  return codeMap[status] || 'HTTP_ERROR';
};

// ─── Type Guards ────────────────────────────────────────────────────────────

export const isAxiosError = (error: unknown): error is AxiosError => {
  return !!(error && typeof error === 'object' && 'isAxiosError' in error);
};

export const isApiError = (error: unknown): error is ApiError => {
  return !!(
    error &&
    typeof error === 'object' &&
    'userMessage' in error &&
    'code' in error &&
    'timestamp' in error
  );
};

export const isNetworkError = (error: ApiError): boolean => {
  return error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT' || error.status === 0;
};

export const isAuthError = (error: ApiError): boolean => {
  return error.status === 401 || error.code === 'UNAUTHORIZED';
};

export const isRetryableError = (error: unknown): boolean => {
  if (isApiError(error)) return error.isRetryable;

  if (isAxiosError(error)) {
    if (!error.response) return true;  // Network errors
    const status = error.response.status;
    return status >= 500 || status === 429 || status === 408;
  }

  return false;
};

// ─── Main: Handle Error ─────────────────────────────────────────────────────

export const handleError = (error: unknown, context?: string, silent = false): ApiError => {
  const parsed = parseError(error, context);
  const severity = getSeverity(parsed.status);

  // Notify listeners (toast system, analytics, etc.)
  if (!silent) {
    notifyListeners({ error: parsed, severity, context });
  }

  // Structured console logging
  if (process.env.NODE_ENV === 'development') {
    const logStyle = severity === 'critical' ? 'color: #ef4444; font-weight: bold' :
                     severity === 'error'    ? 'color: #f97316' :
                     severity === 'warning'  ? 'color: #eab308' : 'color: #6b7280';

    console.groupCollapsed(`%c[${severity.toUpperCase()}] ${parsed.code} — ${parsed.message}`, logStyle);
    console.log('Status:', parsed.status);
    console.log('User Message:', parsed.userMessage);
    console.log('Retryable:', parsed.isRetryable);
    if (parsed.details) console.log('Details:', parsed.details);
    if (parsed.requestId) console.log('Request ID:', parsed.requestId);
    if (context) console.log('Context:', context);
    console.log('Raw Error:', error);
    console.groupEnd();
  }

  return parsed;
};

// ─── Utility: Throw Typed Error ─────────────────────────────────────────────

export const throwError = (message: string, code = 'APP_ERROR', details?: unknown): never => {
  const error: ApiError = {
    message,
    userMessage: message,
    code,
    status: 0,
    isRetryable: false,
    timestamp: Date.now(),
    details,
  };
  throw error;
};
