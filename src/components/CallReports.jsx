import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { getBaseApiUrlForEndpoints } from '../config/api'
import './CallReports.css'

const CallReports = () => {
  const [activeSubTab, setActiveSubTab] = useState('alerts-call') // 'alerts-call' or 'web-call'
  const [alertsData, setAlertsData] = useState([])
  const [webData, setWebData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  
  // Filters for Alerts Call Report
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0], // Today as default
    reason: '',
    carrier: '',
    fleet: '',
    driver: ''
  })
  const [filterOptions, setFilterOptions] = useState({
    reasons: [],
    carriers: [],
    fleets: [],
    drivers: []
  })

  const baseApiUrl = getBaseApiUrlForEndpoints()

  const fetchFilterOptions = async () => {
    try {
      console.log('🔍 Fetching filter options from:', `${baseApiUrl}/api/reports/filters`)
      const response = await axios.get(`${baseApiUrl}/api/reports/filters`, {
        timeout: 30000,
      })
      console.log('✅ Filter options received:', response.data)
      console.log('📊 Reasons count:', response.data?.reasons?.length || 0)
      console.log('📊 Carriers count:', response.data?.carriers?.length || 0)
      console.log('📊 Fleets count:', response.data?.fleets?.length || 0)
      console.log('📊 Drivers count:', response.data?.drivers?.length || 0)
      setFilterOptions(response.data || {
        reasons: [],
        carriers: [],
        fleets: [],
        drivers: []
      })
    } catch (err) {
      console.error('❌ Error fetching filter options:', err)
      setFilterOptions({
        reasons: [],
        carriers: [],
        fleets: [],
        drivers: []
      })
    }
  }

  // Fetch filter options for Alerts Call Report
  useEffect(() => {
    if (activeSubTab === 'alerts-call') {
      fetchFilterOptions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab])

  // Fetch data when sub-tab changes, filters change, or pagination changes
  useEffect(() => {
    if (activeSubTab === 'alerts-call') {
      fetchAlertsCallReport()
    } else if (activeSubTab === 'web-call') {
      fetchWebCallReport()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab, filters, pagination.page, pagination.limit])

  const fetchAlertsCallReport = async () => {
    // Build cache key
    const cacheKey = `alerts-call-${filters.date}-${filters.reason}-${filters.carrier}-${filters.fleet}-${filters.driver}-${pagination.page}-${pagination.limit}`
    
    // Check localStorage cache first (5 minutes TTL)
    const cachedData = localStorage.getItem(cacheKey)
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData)
        const cacheAge = Date.now() - parsed.timestamp
        const cacheTTL = 5 * 60 * 1000 // 5 minutes
        
        if (cacheAge < cacheTTL) {
          console.log('📦 Using cached data for alerts call report')
          // Show cached data immediately (no loading)
          setAlertsData(parsed.data || [])
          setPagination(prev => ({
            ...prev,
            total: parsed.total || 0,
            totalPages: parsed.totalPages || 0
          }))
          setLoading(false)
          setError('')
          
          // Fetch fresh data in background (silent update)
          fetchFreshData(cacheKey)
          return
        }
      } catch (e) {
        console.warn('Failed to parse cached data:', e)
      }
    }
    
    // No cache or cache expired - fetch with loading
    setLoading(true)
    setError('')
    await fetchFreshData(cacheKey)
  }

  const fetchFreshData = async (cacheKey) => {
    try {
      const params = new URLSearchParams()
      if (filters.date) params.append('date', filters.date)
      if (filters.reason && filters.reason.trim()) params.append('reason', filters.reason.trim())
      if (filters.carrier && filters.carrier.trim()) params.append('carrier', filters.carrier.trim())
      if (filters.fleet && filters.fleet.trim()) params.append('fleet', filters.fleet.trim())
      if (filters.driver && filters.driver.trim()) params.append('driver', filters.driver.trim())
      params.append('page', pagination.page)
      params.append('limit', pagination.limit)
      
      console.log('🔍 Fetching with filters:', {
        date: filters.date,
        reason: filters.reason,
        carrier: filters.carrier,
        fleet: filters.fleet,
        driver: filters.driver,
        page: pagination.page,
        limit: pagination.limit
      })

      const response = await axios.get(`${baseApiUrl}/api/reports/alerts-call?${params.toString()}`, {
        timeout: 30000,
      })
      
      // Handle new response format with pagination
      if (response.data && response.data.data) {
        const data = response.data.data || []
        const total = response.data.total || 0
        const totalPages = response.data.total_pages || 0
        
        setAlertsData(data)
        setPagination(prev => ({
          ...prev,
          total: total,
          totalPages: totalPages
        }))
        
        // Cache the result
        localStorage.setItem(cacheKey, JSON.stringify({
          data: data,
          total: total,
          totalPages: totalPages,
          timestamp: Date.now()
        }))
        
        // Clean old cache entries (keep only last 50)
        try {
          const keys = Object.keys(localStorage).filter(k => k.startsWith('alerts-call-'))
          if (keys.length > 50) {
            // Sort by key (which includes timestamp) and remove oldest
            keys.sort().slice(0, keys.length - 50).forEach(k => localStorage.removeItem(k))
          }
        } catch (e) {
          console.warn('Failed to clean cache:', e)
        }
      } else {
        // Fallback for old format
        setAlertsData(response.data || [])
      }
    } catch (err) {
      console.error('Error fetching alerts call report:', err)
      // Only show error if we don't have cached data
      setAlertsData(prev => {
        if (prev.length === 0) {
          setError('ไม่สามารถโหลดข้อมูลได้')
        }
        return prev
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchWebCallReport = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await axios.get(`${baseApiUrl}/api/reports/web-call`, {
        timeout: 30000,
      })
      setWebData(response.data || [])
    } catch (err) {
      console.error('Error fetching web call report:', err)
      setError('ไม่สามารถโหลดข้อมูลได้')
      setWebData([])
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
    // Reset to page 1 when filter changes
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }))
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const currentData = activeSubTab === 'alerts-call' ? alertsData : webData

  // Get table columns (use first row as reference) and filter out hidden columns
  const allColumns = currentData.length > 0 ? Object.keys(currentData[0]) : []
  // Columns to hide from display (but keep in query)
  const hiddenColumns = [
    'id',
    'duration_from_start_second',
    'kubsave_comment_gps_id',
    'reason_id',
    'hangup_code',
    'is_personal_phone_call',
    'prompt_id',
    'is_call_transferred',
    'transferred_to_number',
    'fleet_id'
  ]
  // Filter columns - case insensitive comparison
  const columns = allColumns.filter(col => {
    const colLower = col.toLowerCase()
    return !hiddenColumns.some(hidden => hidden.toLowerCase() === colLower)
  })

  return (
    <div className="call-reports-container">
      <div className="reports-header">
        <h1 className="reports-title">Call Reports</h1>
      </div>

      {/* Sub-tabs */}
      <div className="sub-tabs">
        <button
          className={`sub-tab ${activeSubTab === 'alerts-call' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('alerts-call')}
        >
          Alerts call report
        </button>
        <button
          className={`sub-tab ${activeSubTab === 'web-call' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('web-call')}
        >
          Web call report
        </button>
      </div>

      {/* Filters for Alerts Call Report */}
      {activeSubTab === 'alerts-call' && (
        <div className="filters-section">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Date</label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => handleFilterChange('date', e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>Reason</label>
              <select
                value={filters.reason}
                onChange={(e) => handleFilterChange('reason', e.target.value)}
                className="filter-select"
              >
                <option value="">All</option>
                {Array.isArray(filterOptions.reasons) && filterOptions.reasons.length > 0 ? (
                  filterOptions.reasons.map((reason, idx) => (
                    <option key={idx} value={reason}>{reason}</option>
                  ))
                ) : (
                  <option disabled>Loading...</option>
                )}
              </select>
            </div>
            <div className="filter-group">
              <label>Carrier</label>
              <select
                value={filters.carrier}
                onChange={(e) => handleFilterChange('carrier', e.target.value)}
                className="filter-select"
              >
                <option value="">All</option>
                {Array.isArray(filterOptions.carriers) && filterOptions.carriers.length > 0 ? (
                  filterOptions.carriers.map((carrier, idx) => (
                    <option key={idx} value={carrier}>{carrier}</option>
                  ))
                ) : (
                  <option disabled>Loading...</option>
                )}
              </select>
            </div>
            <div className="filter-group">
              <label>Fleet</label>
              <select
                value={filters.fleet}
                onChange={(e) => handleFilterChange('fleet', e.target.value)}
                className="filter-select"
              >
                <option value="">All</option>
                {Array.isArray(filterOptions.fleets) && filterOptions.fleets.length > 0 ? (
                  filterOptions.fleets.map((fleet, idx) => (
                    <option key={idx} value={fleet}>{fleet}</option>
                  ))
                ) : (
                  <option disabled>Loading...</option>
                )}
              </select>
            </div>
            <div className="filter-group">
              <label>Driver</label>
              <select
                value={filters.driver}
                onChange={(e) => handleFilterChange('driver', e.target.value)}
                className="filter-select"
              >
                <option value="">All</option>
                {Array.isArray(filterOptions.drivers) && filterOptions.drivers.length > 0 ? (
                  filterOptions.drivers.map((driver, idx) => (
                    <option key={idx} value={driver}>{driver}</option>
                  ))
                ) : (
                  <option disabled>Loading...</option>
                )}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="reports-loading">
          <div className="modern-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <p>กำลังโหลดข้อมูล...</p>
        </div>
      ) : error ? (
        <div className="reports-error">
          <p>❌ {error}</p>
        </div>
      ) : (
        <>
          <div className="reports-table-container">
            <table className="reports-table">
            <thead>
              <tr>
                {columns.map((col, idx) => (
                  <th key={idx} className={col === 'history' ? 'history-column' : ''}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentData.length > 0 ? (
                currentData.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} className={col === 'history' ? 'history-column' : ''}>
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="no-data">ไม่มีข้อมูล</td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
          
          {/* Pagination - Only show for Alerts Call Report */}
          {activeSubTab === 'alerts-call' && pagination.totalPages > 1 && (
            <div className="pagination-container">
              <div className="pagination-info">
                แสดง {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} จาก {pagination.total} รายการ
              </div>
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.page === 1}
                >
                  « หน้าแรก
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  ‹ ก่อนหน้า
                </button>
                
                {/* Page numbers */}
                <div className="pagination-pages">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        className={`pagination-btn ${pagination.page === pageNum ? 'active' : ''}`}
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  ถัดไป ›
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  สุดท้าย »
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default CallReports

