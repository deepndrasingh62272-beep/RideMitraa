/**
 * Centralized error logging service
 * Logs all errors to console with structured format
 */

export interface ErrorLog {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  service: string;
  action: string;
  message: string;
  error?: any;
  context?: Record<string, any>;
  stack?: string;
}

const formatLog = (log: ErrorLog): string => {
  const prefix = `[${log.timestamp}] [${log.level}] [${log.service}/${log.action}]`;
  const msg = log.message;
  const ctx = log.context ? ` | Context: ${JSON.stringify(log.context)}` : '';
  const err = log.error ? ` | Error: ${log.error.message || String(log.error)}` : '';
  const stack = log.stack ? `\n${log.stack}` : '';
  return `${prefix} ${msg}${ctx}${err}${stack}`;
};

export const logError = (
  service: string,
  action: string,
  message: string,
  error?: any,
  context?: Record<string, any>
) => {
  const log: ErrorLog = {
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    service,
    action,
    message,
    error,
    context,
    stack: error?.stack,
  };

  console.error(formatLog(log));
  return log;
};

export const logWarn = (
  service: string,
  action: string,
  message: string,
  context?: Record<string, any>
) => {
  const log: ErrorLog = {
    timestamp: new Date().toISOString(),
    level: 'WARN',
    service,
    action,
    message,
    context,
  };

  console.warn(formatLog(log));
  return log;
};

export const logInfo = (
  service: string,
  action: string,
  message: string,
  context?: Record<string, any>
) => {
  const log: ErrorLog = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    service,
    action,
    message,
    context,
  };

  console.log(formatLog(log));
  return log;
};

export const logDebug = (
  service: string,
  action: string,
  message: string,
  context?: Record<string, any>
) => {
  if (process.env.NODE_ENV === 'development') {
    const log: ErrorLog = {
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      service,
      action,
      message,
      context,
    };

    console.debug(formatLog(log));
    return log;
  }
  return null;
};

export default {
  logError,
  logWarn,
  logInfo,
  logDebug,
};
