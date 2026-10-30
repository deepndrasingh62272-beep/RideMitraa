/**
 * API Axios Instance
 * 
 * Re-exports the centralized apiClient from the services layer.
 * All modules using this file get the same instance with:
 * - Auto auth token injection
 * - Auto retry with exponential backoff
 * - Centralized 401 handling
 * - Request timeout management
 */
export { default, retryRequest, noRetry } from '@/src/services/apiClient';
