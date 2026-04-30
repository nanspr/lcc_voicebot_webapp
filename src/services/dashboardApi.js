import axios from 'axios'
import { getDashboardApiUrl } from '../config/api'

/**
 * API Service for Dashboard Data
 * This service calls a FastAPI backend that queries Azure SQL Server
 * 
 * Backend API should be configured with:
 * - VITE_API_BASE_URL: Base URL for the backend API (e.g., https://app-scgjwdvoicebot-webbackend-dev.azurewebsites.net)
 * - VITE_DASHBOARD_API: Full URL for dashboard API (optional, will use VITE_API_BASE_URL + /api/dashboard if not set)
 */

/**
 * Fetch dashboard statistics from FastAPI backend
 * Expected response format:
 * {
 *   totalCalls: number,
 *   totalDrivers: number,
 *   totalCarriers: number,
 *   reasonChart: Array<{ reason_text: string, count: number }>,
 *   topDrivers: Array<{ person_name: string, count: number }>,
 *   topCarriers: Array<{ carrier_name: string, count: number }>
 * }
 */
export const fetchDashboardData = async () => {
  try {
    const response = await axios.get(getDashboardApiUrl(), {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return response.data
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    throw error
  }
}

/**
 * Expected FastAPI Backend Response Structure:
 * 
 * GET /api/dashboard
 * 
 * Response:
 * {
 *   "totalCalls": 150,
 *   "totalDrivers": 45,
 *   "totalCarriers": 12,
 *   "reasonChart": [
 *     { "reason_text": "Seatbelt reminder", "count": 50 },
 *     { "reason_text": "Speed warning", "count": 30 },
 *     { "reason_text": "Route deviation", "count": 20 }
 *   ],
 *   "topDrivers": [
 *     { "person_name": "John Doe", "count": 25 }
 *   ],
 *   "topCarriers": [
 *     { "carrier_name": "Carrier A", "count": 30 }
 *   ]
 * }
 */

