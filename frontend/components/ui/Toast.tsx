'use client';

import React, { useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { addErrorListener, type ApiError, type ErrorEvent } from '@/src/services/errorHandler';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  WifiOff,
  RefreshCw,
  LogOut,
} from 'lucide-react';

// ─── Toast Configuration ────────────────────────────────────────────────────

const TOAST_DURATION = {
  info: 4_000,
  success: 3_000,
  warning: 5_000,
  error: 6_000,
  critical: 8_000,
} as const;

// ─── Custom Toast Icons ─────────────────────────────────────────────────────

const ToastIcons = {
  info: <Info className="w-5 h-5 text-blue-400" />,
  success: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
  error: <XCircle className="w-5 h-5 text-red-400" />,
  network: <WifiOff className="w-5 h-5 text-orange-400" />,
  logout: <LogOut className="w-5 h-5 text-red-400" />,
} as const;

// ─── Deduplication ──────────────────────────────────────────────────────────

const recentToasts = new Map<string, number>();
const DEDUP_WINDOW_MS = 2_000;

const isDuplicate = (key: string): boolean => {
  const now = Date.now();
  const lastShown = recentToasts.get(key);
  if (lastShown && now - lastShown < DEDUP_WINDOW_MS) {
    return true;
  }
  recentToasts.set(key, now);
  // Cleanup old entries
  if (recentToasts.size > 50) {
    for (const [k, v] of recentToasts) {
      if (now - v > DEDUP_WINDOW_MS) recentToasts.delete(k);
    }
  }
  return false;
};

// ─── Show Error Toast ───────────────────────────────────────────────────────

const showErrorToast = (event: ErrorEvent) => {
  const { error, severity, context } = event;
  const dedupKey = `${error.code}:${error.status}:${context || ''}`;

  if (isDuplicate(dedupKey)) return;

  // Special handling for auth errors — don't toast, handled by redirect
  if (error.status === 401) return;

  // Network error — special UI
  if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
    toast.error(error.userMessage, {
      id: 'network-error',
      duration: TOAST_DURATION.critical,
      icon: ToastIcons.network,
      description: 'Check your internet connection and try again.',
      action: {
        label: 'Retry',
        onClick: () => window.location.reload(),
      },
    });
    return;
  }

  // Retryable error — offer retry
  if (error.isRetryable && severity === 'critical') {
    toast.error(error.userMessage, {
      duration: TOAST_DURATION.critical,
      icon: ToastIcons.error,
      description: 'The server is having issues. Retrying automatically...',
    });
    return;
  }

  // Standard error toast
  const toastFn = severity === 'warning' ? toast.warning : toast.error;
  const icon = severity === 'warning' ? ToastIcons.warning : ToastIcons.error;
  const duration = severity === 'critical' ? TOAST_DURATION.critical :
                   severity === 'warning'  ? TOAST_DURATION.warning : TOAST_DURATION.error;

  toastFn(error.userMessage, {
    duration,
    icon,
    description: error.requestId ? `Ref: ${error.requestId}` : undefined,
  });
};

// ─── Public Toast Helpers ───────────────────────────────────────────────────

export const showToast = {
  success: (message: string, options?: { description?: string; duration?: number }) => {
    toast.success(message, {
      duration: options?.duration ?? TOAST_DURATION.success,
      icon: ToastIcons.success,
      description: options?.description,
    });
  },

  error: (message: string, options?: { description?: string; duration?: number }) => {
    toast.error(message, {
      duration: options?.duration ?? TOAST_DURATION.error,
      icon: ToastIcons.error,
      description: options?.description,
    });
  },

  warning: (message: string, options?: { description?: string; duration?: number }) => {
    toast.warning(message, {
      duration: options?.duration ?? TOAST_DURATION.warning,
      icon: ToastIcons.warning,
      description: options?.description,
    });
  },

  info: (message: string, options?: { description?: string; duration?: number }) => {
    toast.info(message, {
      duration: options?.duration ?? TOAST_DURATION.info,
      icon: ToastIcons.info,
      description: options?.description,
    });
  },

  loading: (message: string) => {
    return toast.loading(message);
  },

  dismiss: (id?: string | number) => {
    toast.dismiss(id);
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string }
  ) => {
    return toast.promise(promise, messages);
  },
};

// ─── ToastProvider Component ────────────────────────────────────────────────

export function ToastProvider() {
  // Subscribe to error events from the centralized error handler
  useEffect(() => {
    const unsubscribe = addErrorListener(showErrorToast);
    return unsubscribe;
  }, []);

  return (
    <Toaster
      position="top-right"
      expand={false}
      richColors
      closeButton
      toastOptions={{
        style: {
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          color: '#f8fafc',
          borderRadius: '14px',
          padding: '14px 18px',
          boxShadow: '0 20px 60px -15px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.05)',
          fontSize: '14px',
          fontFamily: "'Inter', system-ui, sans-serif",
          lineHeight: '1.5',
        },
        className: 'ridemitra-toast',
      }}
      offset={16}
      gap={8}
      visibleToasts={4}
    />
  );
}

export default ToastProvider;
