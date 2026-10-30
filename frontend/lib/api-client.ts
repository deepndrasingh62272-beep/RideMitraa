/**
 * lib/api-client
 * 
 * Re-exports the centralized apiClient from the services layer.
 * This ensures all parts of the app use the same axios instance with:
 * - Auto auth token injection
 * - Auto retry with exponential backoff + jitter
 * - Centralized 401 handling (token cleanup + redirect)
 * - 30s request timeout
 * 
 * For manual retry: import { retryRequest } from '@/src/services/apiClient'
 * To skip retry: import { noRetry } from '@/src/services/apiClient'
 */
export { default } from '@/src/services/apiClient';
export { retryRequest, noRetry, onAuthEvent } from '@/src/services/apiClient';
