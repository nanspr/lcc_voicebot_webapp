/**
 * Example Backend API Server (Node.js + Express)
 * 
 * This is an example of how to create a backend API that queries Azure SQL Server
 * and returns dashboard data in the format expected by the frontend.
 * 
 * To use this:
 * 1. Install dependencies: npm install express mssql dotenv
 * 2. Create .env file with: AZURE_SQL_CONNECTION_STRING=your_connection_string
 * 3. Run: node backend-api-example.js
 */

const express = require('express')
const sql = require('mssql')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3000

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  next()
})

app.use(express.json())

// Azure SQL Connection Pool
// Port 1433 คือ port ของ Azure SQL Server (ไม่ใช่ port ของ backend API)
const sqlConfig = {
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  server: process.env.AZURE_SQL_SERVER, // เช่น: your-server.database.windows.net
  database: process.env.AZURE_SQL_DATABASE,
  port: parseInt(process.env.AZURE_SQL_PORT) || 1433, // Port ของ SQL Server (default 1433)
  options: {
    encrypt: true, // Azure SQL ต้องใช้ encrypt
    trustServerCertificate: false,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
}

console.log('🔌 SQL Config:', {
  server: sqlConfig.server,
  database: sqlConfig.database,
  port: sqlConfig.port,
  user: sqlConfig.user ? '***' : 'not set',
})

// Dashboard API Endpoint
app.get('/api/dashboard', async (req, res) => {
  let pool
  
  try {
    console.log('📊 Dashboard API called - Connecting to Azure SQL...')
    // Connect to Azure SQL
    pool = await sql.connect(sqlConfig)
    console.log('✅ Connected to Azure SQL successfully')
    
    const baseWhere = `
      FROM [sqldb-scgjwd-voicebot-prd].dbo.vb_history_log hl
      WHERE prompt_id = 2
        AND CAST(DATEADD(HOUR, 7, hl.created_at) AS DATE) >= CAST(GETDATE() AS DATE)
    `

    const statsQuery = `
      SELECT 
        COUNT(DISTINCT hl.id) AS totalCalls,
        COUNT(DISTINCT hl.person_name) AS totalDrivers,
        COUNT(DISTINCT hl.carrier_name) AS totalCarriers
      ${baseWhere}
    `

    const reasonChartQuery = `
      SELECT 
        CASE 
          WHEN reason_text IS NULL OR LTRIM(RTRIM(reason_text)) = '' THEN 'Unknown'
          ELSE reason_text
        END AS reason_text,
        COUNT(DISTINCT hl.id) AS count
      ${baseWhere}
      GROUP BY CASE 
        WHEN reason_text IS NULL OR LTRIM(RTRIM(reason_text)) = '' THEN 'Unknown'
        ELSE reason_text
      END
      ORDER BY count DESC
    `
    
    const statsResult = await pool.request().query(statsQuery)
    const reasonResult = await pool.request().query(reasonChartQuery)
    
    const { totalCalls, totalDrivers, totalCarriers } = statsResult.recordset[0] || {
      totalCalls: 0,
      totalDrivers: 0,
      totalCarriers: 0,
    }
    
    const normalizeReasonText = (value) => {
      if (Array.isArray(value)) {
        return value.find(text => text && text.trim()) || 'Unknown'
      }
      if (value && typeof value === 'string') {
        return value.trim()
      }
      return 'Unknown'
    }
    
    const reasonChart = (reasonResult.recordset || []).map(item => ({
      reason_text: normalizeReasonText(item.reason_text),
      count: item.count
    }))

    const topDriversQuery = `
      SELECT TOP 10
        CASE 
          WHEN person_name IS NULL OR LTRIM(RTRIM(person_name)) = '' THEN 'Unknown'
          ELSE person_name
        END AS person_name,
        COUNT(DISTINCT hl.id) AS count
      ${baseWhere}
      GROUP BY CASE 
        WHEN person_name IS NULL OR LTRIM(RTRIM(person_name)) = '' THEN 'Unknown'
        ELSE person_name
      END
      ORDER BY count DESC
    `

    const topCarriersQuery = `
      SELECT TOP 10
        CASE 
          WHEN carrier_name IS NULL OR LTRIM(RTRIM(carrier_name)) = '' THEN 'Unknown'
          ELSE carrier_name
        END AS carrier_name,
        COUNT(DISTINCT hl.id) AS count
      ${baseWhere}
      GROUP BY CASE 
        WHEN carrier_name IS NULL OR LTRIM(RTRIM(carrier_name)) = '' THEN 'Unknown'
        ELSE carrier_name
      END
      ORDER BY count DESC
    `

    const topDriversResult = await pool.request().query(topDriversQuery)
    const topCarriersResult = await pool.request().query(topCarriersQuery)

    const topDrivers = (topDriversResult.recordset || []).map(item => ({
      person_name: normalizeReasonText(item.person_name),
      count: item.count
    }))

    const topCarriers = (topCarriersResult.recordset || []).map(item => ({
      carrier_name: normalizeReasonText(item.carrier_name),
      count: item.count
    }))
    
    console.log('📊 Statistics calculated:')
    console.log('   Total Calls:', totalCalls)
    console.log('   Total Drivers:', totalDrivers)
    console.log('   Total Carriers:', totalCarriers)
    console.log('   Reason Chart items:', reasonChart.length)
    if (reasonChart.length > 0) {
      console.log('   Reason Chart sample (first 3):', JSON.stringify(reasonChart.slice(0, 3), null, 2))
    }
    console.log('   Top Drivers items:', topDrivers.length)
    console.log('   Top Carriers items:', topCarriers.length)
    
    const response = {
      totalCalls,
      totalDrivers,
      totalCarriers,
      reasonChart,
      topDrivers,
      topCarriers,
    }
    
    console.log('📤 Sending response with reasonChart length:', reasonChart.length)
    res.json(response)
    
  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({
      error: 'Failed to fetch dashboard data',
      message: error.message,
    })
  } finally {
    if (pool) {
      await pool.close()
    }
  }
})

app.listen(PORT, () => {
  console.log('='.repeat(50))
  console.log(`🚀 Dashboard API server running on port ${PORT}`)
  console.log(`📡 Access dashboard at: http://localhost:${PORT}/api/dashboard`)
  console.log(`🔌 SQL Server port: ${sqlConfig.port}`)
  console.log(`💾 Database: ${sqlConfig.database || 'not set'}`)
  console.log('='.repeat(50))
  console.log('⚠️  Make sure you have set these environment variables:')
  console.log('   - AZURE_SQL_USER')
  console.log('   - AZURE_SQL_PASSWORD')
  console.log('   - AZURE_SQL_SERVER')
  console.log('   - AZURE_SQL_DATABASE')
  console.log('   - AZURE_SQL_PORT (optional, default: 1433)')
  console.log('='.repeat(50))
})

