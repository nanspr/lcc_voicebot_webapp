/**
 * Centralized API Configuration
 * 
 * This file manages all API endpoints in one place.
 * To change API URLs, update the environment variables in .env or local.env
 * 
 * Environment Variables:
 * - VITE_API_BASE_URL: Base URL for the backend API (e.g., https://app-scgjwdvoicebot-webbackend-dev.azurewebsites.net)
 * - VITE_DASHBOARD_API: Full URL for dashboard API (optional, will use VITE_API_BASE_URL if not set)
 * - VITE_INFORM_AGENT_API: URL for InformAgent API
 * - VITE_TTS_API: URL for TTS API
 * - VITE_PHONE_CALL_API: URL for Phone Call API
 */

/**
 * Get the base API URL from environment variable
 * Default: https://app-scgjwdvoicebot-webbackend-dev.azurewebsites.net
 */
const getBaseApiUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || 'https://app-scgjwdvoicebot-webbackend-dev.azurewebsites.net'
}

/**
 * Get the dashboard API URL
 * Priority: VITE_DASHBOARD_API > VITE_API_BASE_URL + /api/dashboard
 */
export const getDashboardApiUrl = () => {
  if (import.meta.env.VITE_DASHBOARD_API) {
    return import.meta.env.VITE_DASHBOARD_API
  }
  return `${getBaseApiUrl()}/api/dashboard`
}

/**
 * Get the base API URL (without /api/dashboard)
 * Used for constructing other API endpoints
 */
export const getBaseApiUrlForEndpoints = () => {
  const dashboardUrl = getDashboardApiUrl()
  // Remove /api/dashboard if it exists
  return dashboardUrl.replace(/\/api\/dashboard\/?$/, '') || getBaseApiUrl()
}

/**
 * Get InformAgent API URL
 */
export const getInformAgentApiUrl = () => {
  return import.meta.env.VITE_INFORM_AGENT_API || 'https://n8n.scgjwd.com/webhook/InformAgent'
}

/**
 * Get TTS API URL
 */
export const getTTSApiUrl = () => {
  return import.meta.env.VITE_TTS_API || 'https://voice-tts.botnoi.ai/scgjwd/api/doctts'
}

/**
 * Get Phone Call API URL
 */
export const getPhoneCallApiUrl = () => {
  return import.meta.env.VITE_PHONE_CALL_API || 'https://api-voicebot.scgjwd.com/api/queue/customer/add_queue'
}

/**
 * Helper to construct API endpoint URLs
 * @param {string} endpoint - API endpoint path (e.g., '/api/reports/filters')
 * @returns {string} Full URL
 */
export const getApiEndpoint = (endpoint) => {
  const baseUrl = getBaseApiUrlForEndpoints()
  // Ensure endpoint starts with /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${baseUrl}${cleanEndpoint}`
}

// Export base URL getter for direct use if needed
export { getBaseApiUrl }

