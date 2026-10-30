'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'section' | 'component';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ─── Error Boundary Component ───────────────────────────────────────────────

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log to console in dev
    if (process.env.NODE_ENV === 'development') {
      console.group('%c[ErrorBoundary] Caught an error', 'color: #ef4444; font-weight: bold');
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }

    // Notify parent
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Custom fallback
    if (this.props.fallback) {
      return this.props.fallback;
    }

    const level = this.props.level || 'page';

    // Section-level: minimal inline error
    if (level === 'component') {
      return <ComponentErrorFallback onRetry={this.handleRetry} />;
    }

    if (level === 'section') {
      return (
        <SectionErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    // Page-level: full-page error
    return (
      <PageErrorFallback
        error={this.state.error}
        errorInfo={this.state.errorInfo}
        onRetry={this.handleRetry}
        onGoHome={this.handleGoHome}
        onReload={this.handleReload}
      />
    );
  }
}

// ─── Component-Level Fallback ───────────────────────────────────────────────

function ComponentErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1">Something went wrong</span>
      <button
        onClick={onRetry}
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors text-xs font-medium"
      >
        <RefreshCw className="w-3 h-3" /> Retry
      </button>
    </div>
  );
}

// ─── Section-Level Fallback ─────────────────────────────────────────────────

function SectionErrorFallback({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-gradient-to-br from-red-500/5 to-orange-500/5 border border-red-500/10">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-200 mb-1">
        Failed to load this section
      </h3>
      <p className="text-sm text-slate-400 mb-4 text-center max-w-sm">
        {error?.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-sm font-medium transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 active:scale-95"
      >
        <RefreshCw className="w-4 h-4" /> Try again
      </button>
    </div>
  );
}

// ─── Page-Level Fallback ────────────────────────────────────────────────────

function PageErrorFallback({
  error,
  errorInfo,
  onRetry,
  onGoHome,
  onReload,
}: {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onRetry: () => void;
  onGoHome: () => void;
  onReload: () => void;
}) {
  const [showDetails, setShowDetails] = React.useState(false);
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      {/* Background effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg w-full">
        {/* Card */}
        <div
          className="rounded-3xl border border-white/5 p-8 text-center"
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.03)',
          }}
        >
          {/* Icon */}
          <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500/20 to-orange-500/10 flex items-center justify-center mb-6 shadow-lg shadow-red-500/10">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Something went wrong
          </h1>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
            We encountered an unexpected error. Don&apos;t worry — your data is safe.
            Try refreshing the page or go back to the home screen.
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <button
              onClick={onRetry}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 active:scale-95"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
            <button
              onClick={onGoHome}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium transition-all border border-white/10 hover:border-white/20 active:scale-95"
            >
              <Home className="w-4 h-4" /> Go home
            </button>
          </div>

          {/* Reload hint */}
          <button
            onClick={onReload}
            className="text-xs text-slate-500 hover:text-slate-400 transition-colors underline underline-offset-2"
          >
            Or reload the entire page
          </button>

          {/* Dev Details */}
          {isDev && error && (
            <div className="mt-6 text-left">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors mb-2"
              >
                <Bug className="w-3.5 h-3.5" />
                {showDetails ? 'Hide' : 'Show'} error details
              </button>

              {showDetails && (
                <div className="rounded-xl bg-black/40 border border-white/5 p-4 overflow-auto max-h-64">
                  <p className="text-xs font-mono text-red-400 mb-2 break-all">
                    {error.message}
                  </p>
                  {errorInfo?.componentStack && (
                    <pre className="text-xs font-mono text-slate-500 whitespace-pre-wrap break-all">
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Convenience Wrappers ───────────────────────────────────────────────────

export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary level="page">{children}</ErrorBoundary>;
}

export function SectionErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary level="section">{children}</ErrorBoundary>;
}

export function ComponentErrorBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary level="component">{children}</ErrorBoundary>;
}

export default ErrorBoundary;
