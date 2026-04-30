import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { BarChart, Bar, LineChart, Line, Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getDashboardApiUrl, getApiEndpoint } from '../config/api'
import './Dashboard.css'

const Dashboard = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({
    totalCalls: 0,
    totalDrivers: 0,
    totalCarriers: 0,
    answeredRate: 0,
    reasonChart: [],
    topDrivers: [],
    topCarriers: [],
  })
  const [callsByTime, setCallsByTime] = useState([])
  const [callsByTimeLoading, setCallsByTimeLoading] = useState(false)
  const [heatmapData, setHeatmapData] = useState([])
  const [heatmapLoading, setHeatmapLoading] = useState(false)
  const [durationData, setDurationData] = useState([])
  const [durationLoading, setDurationLoading] = useState(false)

  useEffect(() => {
    fetchDashboardData()
    fetchCallsByTime()
    fetchHeatmapData()
    fetchDurationFromStartToAnswer()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    setError('')
    
    try {
      const apiUrl = getDashboardApiUrl()
      
      console.log('📊 Fetching dashboard data from:', apiUrl)
      console.log('📊 Environment VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL)
      console.log('📊 Environment VITE_DASHBOARD_API:', import.meta.env.VITE_DASHBOARD_API)
      
      const response = await axios.get(apiUrl, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('📊 Dashboard response status:', response.status)
      console.log('📊 Dashboard response data:', response.data)

      if (response.data) {
        setStats({
          totalCalls: response.data.totalCalls || 0,
          totalDrivers: response.data.totalDrivers || 0,
          totalCarriers: response.data.totalCarriers || 0,
          answeredRate: response.data.answeredRate || 0,
          reasonChart: response.data.reasonChart || [],
          topDrivers: response.data.topDrivers || [],
          topCarriers: response.data.topCarriers || [],
        })
        console.log('✅ Dashboard data loaded successfully')
      } else {
        setError('ไม่ได้รับข้อมูลจาก API')
      }
    } catch (err) {
      console.error('❌ Error fetching dashboard data:', err)
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        response: err.response?.data,
        status: err.response?.status,
        config: {
          url: err.config?.url,
          method: err.config?.method,
        },
      })
      
      let errorMessage = 'ไม่สามารถโหลดข้อมูลได้'
      
      if (err.code === 'ECONNREFUSED' || err.code === 'ERR_CONNECTION_REFUSED') {
        const apiUrl = getDashboardApiUrl()
        errorMessage = `ไม่สามารถเชื่อมต่อกับ API server ได้ กรุณาตรวจสอบว่า backend API รันอยู่ที่ ${apiUrl} หรือไม่`
        console.error('💡 ตรวจสอบว่า:')
        console.error(`   1. Backend API รันอยู่ที่ ${apiUrl} หรือไม่?`)
        console.error('   2. ตรวจสอบ network connection และ firewall')
        console.error(`   3. ทดสอบด้วย: curl ${apiUrl}`)
      } else if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        const apiUrl = getDashboardApiUrl()
        errorMessage = 'Network Error - ไม่สามารถเชื่อมต่อกับ API server ได้ กรุณาตรวจสอบว่า backend API รันอยู่หรือไม่'
        console.error('💡 Network Error - ตรวจสอบว่า:')
        console.error(`   1. Backend API รันอยู่ที่ ${apiUrl}`)
        console.error('   2. ไม่มี firewall หรือ proxy block การเชื่อมต่อ')
        console.error(`   3. ทดสอบด้วย: curl ${apiUrl}`)
      } else if (err.response) {
        errorMessage = `เกิดข้อผิดพลาด: ${err.response.status} - ${err.response.statusText}`
        if (err.response.data) {
          console.error('Error response data:', err.response.data)
        }
      } else if (err.message) {
        errorMessage = `เกิดข้อผิดพลาด: ${err.message}`
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const fetchCallsByTime = async () => {
    setCallsByTimeLoading(true)
    
    try {
      const callsByTimeUrl = getApiEndpoint('/api/dashboard/calls-by-time')
      
      console.log('📊 Fetching calls by time from:', callsByTimeUrl)
      
      const response = await axios.get(callsByTimeUrl, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('📊 Calls by time response:', response.data)

      if (response.data && Array.isArray(response.data)) {
        setCallsByTime(response.data)
        console.log('✅ Calls by time data loaded successfully')
      } else {
        console.warn('⚠️ Invalid calls by time data format')
        setCallsByTime([])
      }
    } catch (err) {
      console.error('❌ Error fetching calls by time:', err)
      setCallsByTime([])
    } finally {
      setCallsByTimeLoading(false)
    }
  }

  const fetchHeatmapData = async () => {
    setHeatmapLoading(true)
    
    try {
      const heatmapUrl = getApiEndpoint('/api/dashboard/heatmap')
      
      console.log('📊 Fetching heatmap data from:', heatmapUrl)
      
      const response = await axios.get(heatmapUrl, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('📊 Heatmap response:', response.data)

      if (response.data && Array.isArray(response.data)) {
        setHeatmapData(response.data)
        console.log('✅ Heatmap data loaded successfully')
      } else {
        console.warn('⚠️ Invalid heatmap data format')
        setHeatmapData([])
      }
    } catch (err) {
      console.error('❌ Error fetching heatmap data:', err)
      setHeatmapData([])
    } finally {
      setHeatmapLoading(false)
    }
  }

  const fetchDurationFromStartToAnswer = async () => {
    setDurationLoading(true)
    
    try {
      const durationUrl = getApiEndpoint('/api/dashboard/duration-from-start-to-answer')
      
      console.log('📊 Fetching duration from start to answer data from:', durationUrl)
      
      const response = await axios.get(durationUrl, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('📊 Duration response:', response.data)

      if (response.data && Array.isArray(response.data)) {
        setDurationData(response.data)
        console.log('✅ Duration data loaded successfully')
      } else {
        console.warn('⚠️ Invalid duration data format')
        setDurationData([])
      }
    } catch (err) {
      console.error('❌ Error fetching duration data:', err)
      setDurationData([])
    } finally {
      setDurationLoading(false)
    }
  }

  const maxDriverCount = stats.topDrivers.reduce((max, item) => Math.max(max, item.count || 0), 0)
  const maxCarrierCount = stats.topCarriers.reduce((max, item) => Math.max(max, item.count || 0), 0)

  const getRowGradient = (value, max) => {
    if (!max) return {}
    const ratio = value / max
    const start = 0.15 + ratio * 0.4
    const end = 0.05 + ratio * 0.3
    return {
      background: `linear-gradient(90deg, rgba(99,102,241,${start}) 0%, rgba(167,139,250,${end}) 100%)`,
    }
  }

  // Process heatmap data
  const processHeatmapData = () => {
    if (!heatmapData || heatmapData.length === 0) return { matrix: [], hours: [], reasons: [], maxCount: 0 }

    // Get unique hours and reasons
    const hoursSet = new Set()
    const reasonsSet = new Set()
    const dataMap = new Map()

    heatmapData.forEach(item => {
      hoursSet.add(item.hour)
      reasonsSet.add(item.reason_text)
      const key = `${item.hour}-${item.reason_text}`
      dataMap.set(key, item.count)
    })

    const hours = Array.from(hoursSet).sort((a, b) => a - b)
    const reasons = Array.from(reasonsSet).sort()

    // Find max count for normalization
    const maxCount = Math.max(...Array.from(dataMap.values()), 1)

    // Build matrix
    const matrix = reasons.map(reason => {
      return hours.map(hour => {
        const key = `${hour}-${reason}`
        return dataMap.get(key) || 0
      })
    })

    return { matrix, hours, reasons, maxCount }
  }

  const { matrix, hours, reasons, maxCount } = processHeatmapData()

  // Get heatmap cell color based on value
  const getHeatmapColor = (value, max) => {
    if (max === 0) return 'rgba(229, 231, 235, 0.3)'
    const ratio = value / max
    
    // Beautiful gradient from light purple to deep purple/pink
    if (ratio === 0) {
      return 'rgba(229, 231, 235, 0.3)'
    } else if (ratio < 0.2) {
      return `rgba(139, 92, 246, ${0.2 + ratio * 0.3})` // Light purple
    } else if (ratio < 0.5) {
      return `rgba(99, 102, 241, ${0.4 + (ratio - 0.2) * 0.4})` // Medium indigo
    } else if (ratio < 0.8) {
      return `rgba(167, 139, 250, ${0.6 + (ratio - 0.5) * 0.3})` // Purple
    } else {
      return `rgba(236, 72, 153, ${0.7 + (ratio - 0.8) * 0.3})` // Pink
    }
  }

  const formatStatValue = (card) => {
    if (card.format === 'percentage') {
      const value = Number.isFinite(card.value) ? card.value : 0
      return `${value.toFixed(1)}%`
    }
    const numericValue = Number.isFinite(card.value) ? card.value : 0
    return numericValue.toLocaleString()
  }

  const statCards = [
    {
      label: 'No. of Calls',
      value: stats.totalCalls,
      icon: (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M5 3h4l2 6-3 1.5a12 12 0 006.5 6.5L16 14l6 2v4a2 2 0 01-2 2A17 17 0 013 5a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: 'No. of Drivers',
      value: stats.totalDrivers,
      icon: (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="12" cy="7" r="4" />
          <path d="M5 21v-2a5 5 0 015-5h4a5 5 0 015 5v2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: 'No. of Carriers',
      value: stats.totalCarriers,
      icon: (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="2" y="9" width="11" height="6.5" rx="1" />
          <path d="M13 12.5h4.2L21 15v-3.8a1 1 0 00-.23-.63L18.5 9H13" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6.5" cy="18.2" r="1.8" />
          <circle cx="18" cy="18.2" r="1.8" />
        </svg>
      ),
    },
    {
      label: 'Answered Rate',
      value: stats.answeredRate,
      format: 'percentage',
      icon: (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M6 3h4l2 7-3 1.5a11 11 0 005.5 5.5L16 14l6 2v4a3 3 0 01-3 3 17 17 0 01-17-17 3 3 0 013-3z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 19c0-2 3-5 5-5 2.5 0 3.5 1.5 5 1.5s3-1.5 3-3" strokeLinecap="round" />
        </svg>
      ),
    },
  ]

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Voicebot Monitoring</h1>
        <p className="dashboard-subtitle">Today's Call</p>
      </div>

      {loading ? (
        <div className="dashboard-loading">
          <div className="loading-spinner">⏳</div>
          <p>กำลังโหลดข้อมูล...</p>
        </div>
      ) : error ? (
        <div className="dashboard-error">
          <p>❌ {error}</p>
          <button className="btn btn-primary" onClick={fetchDashboardData}>
            ลองใหม่
          </button>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="stats-grid">
            {statCards.map((card, idx) => (
              <div className="stat-card" key={card.label}>
                <div className={`stat-icon modern-icon icon-${idx}`}>{card.icon}</div>
                <div className="stat-content">
                  <h3 className="stat-label">{card.label}</h3>
                  <p className="stat-value">{formatStatValue(card)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="chart-container">
            <h2 className="chart-title">Reason by Close Alerts</h2>
            {stats.reasonChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={stats.reasonChart}
                  margin={{ top: 10, right: 24, left: 10, bottom: 115 }}
                >
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.75} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="reason_text"
                    angle={-45}
                    textAnchor="end"
                    height={170}
                    interval={0}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                  />
                  <YAxis
                    tick={{ fill: '#6b7280' }}
                    label={{
                      value: 'Number of Calls',
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#4c1d95',
                      offset: 10,
                    }}
                  />
                  <Tooltip
                    formatter={(value) => [value, 'Number of Calls']}
                    labelFormatter={(label) => `Reason: ${label}`}
                  />
                  <Legend align="center" verticalAlign="top" height={32} iconType="circle" iconSize={10} />
                  <Bar dataKey="count" name="Number of Calls" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">
                <p>ไม่มีข้อมูลสำหรับแสดงกราฟ</p>
              </div>
            )}
          </div>

          <div className="tables-section">
            <div className="table-card">
              <div className="table-header">
                <h3>Top Alerts by Drivers</h3>
                <p>นับจำนวนจาก distinct id ต่อยอดคนขับ</p>
              </div>
              {stats.topDrivers.length ? (
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Driver</th>
                      <th className="align-right">Number of Calls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topDrivers.map((item, index) => (
                      <tr key={`driver-${item.person_name}-${index}`} style={getRowGradient(item.count, maxDriverCount)}>
                        <td>{index + 1}</td>
                        <td>{item.person_name || 'Unknown'}</td>
                        <td className="align-right">{item.count.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="table-empty">ไม่มีข้อมูล</div>
              )}
            </div>

            <div className="table-card">
              <div className="table-header">
                <h3>Top Alerts by Carriers</h3>
                <p>นับจำนวนจาก distinct id ต่อผู้ให้บริการ</p>
              </div>
              {stats.topCarriers.length ? (
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Carrier</th>
                      <th className="align-right">Number of Calls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topCarriers.map((item, index) => (
                      <tr key={`carrier-${item.carrier_name}-${index}`} style={getRowGradient(item.count, maxCarrierCount)}>
                        <td>{index + 1}</td>
                        <td>{item.carrier_name || 'Unknown'}</td>
                        <td className="align-right">{item.count.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="table-empty">ไม่มีข้อมูล</div>
              )}
            </div>
          </div>

          {/* Call alerts by time chart */}
          <div className="chart-container" style={{ marginTop: '2rem' }}>
            <h2 className="chart-title">Performance: Call alerts by time</h2>
            {callsByTimeLoading ? (
              <div className="chart-empty">
                <p>กำลังโหลดข้อมูล...</p>
              </div>
            ) : callsByTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart
                  data={callsByTime}
                  margin={{ top: 10, right: 24, left: 10, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="50%" stopColor="#6366f1" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#ec4899" stopOpacity={0.3} />
                    </linearGradient>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                      <stop offset="50%" stopColor="#6366f1" stopOpacity={1} />
                      <stop offset="100%" stopColor="#ec4899" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    interval={1}
                  />
                  <YAxis
                    tick={{ fill: '#6b7280' }}
                    label={{
                      value: 'No. of calls',
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#4c1d95',
                      offset: 10,
                    }}
                  />
                  <Tooltip
                    formatter={(value) => [value, 'Number of Calls']}
                    labelFormatter={(label) => `Time: ${label}`}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Legend align="center" verticalAlign="top" height={32} iconType="circle" iconSize={10} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Number of Calls"
                    stroke="url(#lineGradient)"
                    strokeWidth={3}
                    fill="url(#areaGradient)"
                    dot={{ fill: '#8b5cf6', r: 4, stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">
                <p>ไม่มีข้อมูลสำหรับแสดงกราฟ</p>
              </div>
            )}
          </div>

          {/* Duration from Start to Answer Chart */}
          <div className="chart-container" style={{ marginTop: '2rem' }}>
            <h2 className="chart-title">ระยะเวลาตั้งแต่เริ่มโทรจนถึงรับสาย</h2>
            {durationLoading ? (
              <div className="chart-empty">
                <p>กำลังโหลดข้อมูล...</p>
              </div>
            ) : durationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={durationData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis 
                    dataKey="time_range" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      color: '#1f2937'
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="count" 
                    name="จำนวนครั้ง"
                    fill="url(#durationGradient)"
                    radius={[8, 8, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="durationGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#667eea" stopOpacity={0.9} />
                      <stop offset="50%" stopColor="#764ba2" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#f093fb" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">
                <p>ไม่มีข้อมูลสำหรับแสดงกราฟ</p>
              </div>
            )}
          </div>

          {/* Heatmap Metrics */}
          <div className="chart-container" style={{ marginTop: '2rem' }}>
            <h2 className="chart-title">Heatmap Metrics: Alerts by Hour x Reason</h2>
            {heatmapLoading ? (
              <div className="chart-empty">
                <p>กำลังโหลดข้อมูล...</p>
              </div>
            ) : matrix.length > 0 && hours.length > 0 ? (
              <div className="heatmap-container">
                <div className="heatmap-wrapper">
                  <div className="heatmap-y-axis">
                    <div className="heatmap-y-label">Reason</div>
                    <div className="heatmap-reasons">
                      {reasons.map((reason, idx) => (
                        <div key={idx} className="heatmap-reason-label" title={reason}>
                          {reason}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="heatmap-content">
                    <div className="heatmap-x-axis">
                      {hours.map((hour) => (
                        <div key={hour} className="heatmap-hour-label">
                          {`${hour.toString().padStart(2, '0')}:00`}
                        </div>
                      ))}
                    </div>
                    <div className="heatmap-grid">
                      {matrix.map((row, rowIdx) => (
                        <div key={rowIdx} className="heatmap-row">
                          {row.map((value, colIdx) => (
                            <div
                              key={colIdx}
                              className="heatmap-cell"
                              style={{
                                backgroundColor: getHeatmapColor(value, maxCount),
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                              }}
                              title={`${reasons[rowIdx]}: ${hours[colIdx]}:00 - ${value} calls`}
                            >
                              {value > 0 && (
                                <span className="heatmap-cell-value">{value}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="heatmap-legend">
                  <div className="heatmap-legend-label">Intensity:</div>
                  <div className="heatmap-legend-gradient">
                    <div className="heatmap-legend-item">
                      <div className="heatmap-legend-color" style={{ backgroundColor: getHeatmapColor(0, maxCount) }}></div>
                      <span>0</span>
                    </div>
                    <div className="heatmap-legend-item">
                      <div className="heatmap-legend-color" style={{ backgroundColor: getHeatmapColor(maxCount * 0.25, maxCount) }}></div>
                      <span>Low</span>
                    </div>
                    <div className="heatmap-legend-item">
                      <div className="heatmap-legend-color" style={{ backgroundColor: getHeatmapColor(maxCount * 0.5, maxCount) }}></div>
                      <span>Medium</span>
                    </div>
                    <div className="heatmap-legend-item">
                      <div className="heatmap-legend-color" style={{ backgroundColor: getHeatmapColor(maxCount * 0.75, maxCount) }}></div>
                      <span>High</span>
                    </div>
                    <div className="heatmap-legend-item">
                      <div className="heatmap-legend-color" style={{ backgroundColor: getHeatmapColor(maxCount, maxCount) }}></div>
                      <span>Max ({maxCount})</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="chart-empty">
                <p>ไม่มีข้อมูลสำหรับแสดงกราฟ</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard

