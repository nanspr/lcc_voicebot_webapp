"""
FastAPI Backend for Dashboard API
This replaces the Node.js backend with Python FastAPI
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi import Request
import pyodbc
import os
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional
import logging
from decimal import Decimal
from datetime import datetime, date, timedelta
from time import time
import httpx
from pydantic import BaseModel

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Dashboard API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory cache for report data
# Cache structure: {cache_key: (data, timestamp)}
# Cache expires after 60 seconds
_report_cache = {}
_cache_ttl = 60  # seconds

# Azure SQL Connection Configuration
def get_available_odbc_driver() -> str:
    """Detect available ODBC Driver for SQL Server"""
    try:
        drivers = [driver for driver in pyodbc.drivers() if 'SQL Server' in driver]
        if not drivers:
            raise ValueError("No ODBC Driver for SQL Server found. Please install ODBC Driver 18 or 17.")
        
        # Prefer Driver 18, fallback to Driver 17
        preferred = next((d for d in drivers if '18' in d), None)
        if preferred:
            return preferred
        return drivers[0]
    except Exception as e:
        logger.error(f"Error detecting ODBC drivers: {e}")
        # Default fallback
        return "ODBC Driver 18 for SQL Server"


def get_sql_connection_string() -> str:
    """Build Azure SQL connection string from environment variables"""
    server = os.getenv("AZURE_SQL_SERVER")
    database = os.getenv("AZURE_SQL_DATABASE")
    username = os.getenv("AZURE_SQL_USER")
    password = os.getenv("AZURE_SQL_PASSWORD")
    port = os.getenv("AZURE_SQL_PORT", "1433")
    
    if not all([server, database, username, password]):
        raise ValueError("Missing required Azure SQL environment variables")
    
    # Try to get available driver, fallback to Driver 18
    try:
        driver = get_available_odbc_driver()
    except:
        driver = "ODBC Driver 18 for SQL Server"
    
    connection_string = (
        f"Driver={{{driver}}};"
        f"Server={server},{port};"
        f"Database={database};"
        f"Uid={username};"
        f"Pwd={password};"
        f"Encrypt=yes;"
        f"TrustServerCertificate=no;"
        f"Connection Timeout=30;"
    )
    return connection_string


def normalize_text(value: Any) -> str:
    """Normalize text values, handling None, empty strings, and arrays"""
    if value is None:
        return "Unknown"
    if isinstance(value, list):
        return next((text.strip() for text in value if text and text.strip()), "Unknown")
    if isinstance(value, str):
        return value.strip() if value.strip() else "Unknown"
    return "Unknown"


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Dashboard API is running", "status": "ok"}


@app.get("/api/dashboard/calls-by-time")
async def get_calls_by_time():
    """
    Get call alerts by time (hour) from Azure SQL Server
    
    Extracts hour from start_call column and groups by hour to count distinct calls
    
    Returns:
        List[{"hour": int, "count": int, "time": str}]
        Example: [{"hour": 0, "count": 10, "time": "00:00"}, {"hour": 1, "count": 15, "time": "01:00"}, ...]
    """
    connection = None
    cursor = None
    
    try:
        logger.info("📊 Calls by time API called - Connecting to Azure SQL...")
        
        # Get connection string
        conn_str = get_sql_connection_string()
        
        # Connect to Azure SQL
        connection = pyodbc.connect(conn_str, timeout=30)
        cursor = connection.cursor()
        logger.info("✅ Connected to Azure SQL successfully")
        
        # Base WHERE clause (same as dashboard)
        base_where = """
            FROM [sqldb-scgjwd-voicebot-prd].dbo.vb_history_log hl
            WHERE prompt_id = 2
              AND CAST(DATEADD(HOUR, 7, hl.created_at) AS DATE) >= CAST(GETDATE() AS DATE)
              AND hl.start_call IS NOT NULL
        """
        
        # Query to extract hour from start_call and count distinct calls
        calls_by_time_query = f"""
            SELECT 
                DATEPART(HOUR, hl.start_call) AS hour,
                COUNT(DISTINCT hl.id) AS count
            {base_where}
            GROUP BY DATEPART(HOUR, hl.start_call)
            ORDER BY hour ASC
        """
        
        cursor.execute(calls_by_time_query)
        time_rows = cursor.fetchall()
        
        # Get current hour (in UTC+7 timezone - Thailand timezone)
        # Get current time in UTC+7 (Thailand timezone)
        # Add 7 hours to UTC to get Thailand time
        current_time_utc7 = datetime.utcnow() + timedelta(hours=7)
        current_hour_utc7 = current_time_utc7.hour
        
        # Format data with hour, count, and formatted time string
        calls_by_time = []
        existing_hours = set()
        
        for row in time_rows:
            hour = int(row[0]) if row[0] is not None else 0
            count = int(row[1]) if row[1] else 0
            time_str = f"{hour:02d}:00"
            
            # Only include hours that have passed (<= current hour)
            if hour <= current_hour_utc7:
                calls_by_time.append({
                    "hour": hour,
                    "count": count,
                    "time": time_str
                })
                existing_hours.add(hour)
        
        # Fill in missing hours with 0 count (only for hours that have passed)
        for hour in range(current_hour_utc7 + 1):
            if hour not in existing_hours:
                calls_by_time.append({
                    "hour": hour,
                    "count": 0,
                    "time": f"{hour:02d}:00"
                })
        
        # Sort by hour
        calls_by_time.sort(key=lambda x: x["hour"])
        
        logger.info(f"📊 Calls by time calculated: {len(calls_by_time)} hours")
        logger.info(f"   Sample data (first 5): {calls_by_time[:5]}")
        
        return JSONResponse(content=calls_by_time)
        
    except Exception as error:
        logger.error(f"❌ Database error in calls by time: {error}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to fetch calls by time data",
                "message": str(error)
            }
        )
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.get("/api/dashboard/heatmap")
async def get_heatmap_data():
    """
    Get heatmap data (hour x reason_text) from Azure SQL Server
    
    Returns heatmap data showing which reasons occur most frequently at each hour.
    
    Returns:
        List[{"hour": int, "reason_text": str, "count": int}]
        Example: [
            {"hour": 0, "reason_text": "Reason 1", "count": 5},
            {"hour": 0, "reason_text": "Reason 2", "count": 3},
            {"hour": 1, "reason_text": "Reason 1", "count": 8},
            ...
        ]
    """
    connection = None
    cursor = None
    
    try:
        logger.info("📊 Heatmap API called - Connecting to Azure SQL...")
        
        # Get connection string
        conn_str = get_sql_connection_string()
        
        # Connect to Azure SQL
        connection = pyodbc.connect(conn_str, timeout=30)
        cursor = connection.cursor()
        logger.info("✅ Connected to Azure SQL successfully")
        
        # Base WHERE clause (same as dashboard)
        base_where = """
            FROM [sqldb-scgjwd-voicebot-prd].dbo.vb_history_log hl
            WHERE prompt_id = 2
              AND CAST(DATEADD(HOUR, 7, hl.created_at) AS DATE) >= CAST(GETDATE() AS DATE)
              AND hl.start_call IS NOT NULL
        """
        
        # Query to get hour, reason_text, and count
        heatmap_query = f"""
            SELECT 
                DATEPART(HOUR, hl.start_call) AS hour,
                CASE 
                    WHEN reason_text IS NULL OR LTRIM(RTRIM(reason_text)) = '' THEN 'Unknown'
                    ELSE reason_text
                END AS reason_text,
                COUNT(DISTINCT hl.id) AS count
            {base_where}
            GROUP BY 
                DATEPART(HOUR, hl.start_call),
                CASE 
                    WHEN reason_text IS NULL OR LTRIM(RTRIM(reason_text)) = '' THEN 'Unknown'
                    ELSE reason_text
                END
            ORDER BY hour ASC, count DESC
        """
        
        cursor.execute(heatmap_query)
        heatmap_rows = cursor.fetchall()
        
        # Get current hour (in UTC+7 timezone - Thailand timezone)
        current_time_utc7 = datetime.utcnow() + timedelta(hours=7)
        current_hour_utc7 = current_time_utc7.hour
        
        # Format data
        heatmap_data = []
        for row in heatmap_rows:
            hour = int(row[0]) if row[0] is not None else 0
            reason_text = normalize_text(row[1])
            count = int(row[2]) if row[2] else 0

            # Skip records without a meaningful reason
            if reason_text.lower() == "unknown":
                continue
            
            # Only include hours that have passed (<= current hour)
            if hour <= current_hour_utc7:
                heatmap_data.append({
                    "hour": hour,
                    "reason_text": reason_text,
                    "count": count
                })
        
        logger.info(f"📊 Heatmap data calculated: {len(heatmap_data)} data points")
        logger.info(f"   Sample data (first 5): {heatmap_data[:5]}")
        
        return JSONResponse(content=heatmap_data)
        
    except Exception as error:
        logger.error(f"❌ Database error in heatmap: {error}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to fetch heatmap data",
                "message": str(error)
            }
        )
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.get("/api/dashboard/duration-from-start-to-answer")
async def get_duration_from_start_to_answer():
    """
    Get duration from start to answer data (duration_from_start_formattime) from Azure SQL Server
    
    Returns data showing frequency of time ranges from call start to answer.
    Skips records where duration_from_start_formattime is NULL.
    
    Returns:
        List[{"time_range": str, "count": int}]
        Example: [
            {"time_range": "00:00:00-00:05:00", "count": 10},
            {"time_range": "00:05:00-00:10:00", "count": 15},
            ...
        ]
    """
    connection = None
    cursor = None
    
    try:
        logger.info("📊 Duration from start to answer API called - Connecting to Azure SQL...")
        
        # Get connection string
        conn_str = get_sql_connection_string()
        
        # Connect to Azure SQL
        connection = pyodbc.connect(conn_str, timeout=30)
        cursor = connection.cursor()
        logger.info("✅ Connected to Azure SQL successfully")
        
        # Query to get duration_from_start_formattime (skip NULL values)
        # Calculate duration from answer_start to created_at (same as alerts-call query)
        # This represents time from when call was answered until record was created
        # Use DISTINCT COUNT id as requested by user
        duration_query = """
            SELECT DISTINCT
                hl.id,
                DATEDIFF(SECOND, hl.answer_start, hl.created_at) AS duration_seconds
            FROM [sqldb-scgjwd-voicebot-prd].dbo.vb_history_log hl
            WHERE prompt_id = 2
              AND CAST(DATEADD(HOUR, 7, hl.created_at) AS DATE) >= CAST(GETDATE() AS DATE)
              AND hl.answer_start IS NOT NULL
              AND hl.created_at IS NOT NULL
              AND DATEDIFF(SECOND, hl.answer_start, hl.created_at) >= 0
        """
        
        cursor.execute(duration_query)
        duration_rows = cursor.fetchall()
        
        logger.info(f"📊 Fetched {len(duration_rows)} records for duration calculation")
        
        # Process data into time ranges
        # Group by time ranges (0-5s, 5-10s, 10-15s, 15-30s, 30-60s, 1-2min, 2-5min, 5-10min, 10min+)
        time_ranges = {
            "0-5 วินาที": 0,
            "5-10 วินาที": 0,
            "10-15 วินาที": 0,
            "15-30 วินาที": 0,
            "30-60 วินาที": 0,
            "1-2 นาที": 0,
            "2-5 นาที": 0,
            "5-10 นาที": 0,
            "10 นาทีขึ้นไป": 0
        }
        
        for row in duration_rows:
            duration_seconds = row[1] if row[1] is not None else 0
            
            if duration_seconds < 5:
                time_ranges["0-5 วินาที"] += 1
            elif duration_seconds < 10:
                time_ranges["5-10 วินาที"] += 1
            elif duration_seconds < 15:
                time_ranges["10-15 วินาที"] += 1
            elif duration_seconds < 30:
                time_ranges["15-30 วินาที"] += 1
            elif duration_seconds < 60:
                time_ranges["30-60 วินาที"] += 1
            elif duration_seconds < 120:
                time_ranges["1-2 นาที"] += 1
            elif duration_seconds < 300:
                time_ranges["2-5 นาที"] += 1
            elif duration_seconds < 600:
                time_ranges["5-10 นาที"] += 1
            else:
                time_ranges["10 นาทีขึ้นไป"] += 1
        
        # Convert to list format for frontend
        duration_data = [
            {"time_range": range_name, "count": count}
            for range_name, count in time_ranges.items()
            if count > 0  # Only include ranges with data
        ]
        
        logger.info(f"📊 Duration from start to answer data: {len(duration_data)} time ranges")
        logger.info(f"   Total records: {sum(time_ranges.values())}")
        
        return JSONResponse(content=duration_data)
        
    except Exception as error:
        logger.error(f"❌ Database error in duration from start to answer: {error}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to fetch duration from start to answer data",
                "message": str(error)
            }
        )
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.get("/api/dashboard")
async def get_dashboard_data():
    """
    Get dashboard statistics from Azure SQL Server
    
    Returns:
        {
            "totalCalls": int,
            "totalDrivers": int,
            "totalCarriers": int,
            "reasonChart": List[{"reason_text": str, "count": int}],
            "topDrivers": List[{"person_name": str, "count": int}],
            "topCarriers": List[{"carrier_name": str, "count": int}]
        }
    """
    connection = None
    cursor = None
    
    try:
        logger.info("📊 Dashboard API called - Connecting to Azure SQL...")
        
        # Get connection string
        conn_str = get_sql_connection_string()
        
        # Connect to Azure SQL
        connection = pyodbc.connect(conn_str, timeout=30)
        cursor = connection.cursor()
        logger.info("✅ Connected to Azure SQL successfully")
        
        # Base WHERE clause
        base_where = """
            FROM [sqldb-scgjwd-voicebot-prd].dbo.vb_history_log hl
            WHERE prompt_id = 2
              AND CAST(DATEADD(HOUR, 7, hl.created_at) AS DATE) >= CAST(GETDATE() AS DATE)
        """
        
        # Stats query
        stats_query = f"""
            SELECT 
                COUNT(DISTINCT hl.id) AS totalCalls,
                COUNT(DISTINCT hl.person_name) AS totalDrivers,
                COUNT(DISTINCT hl.carrier_name) AS totalCarriers,
                SUM(CASE WHEN reason_id IN (561, 563) THEN 1 ELSE 0 END) AS missedCalls
            {base_where}
        """
        
        # Execute stats query
        cursor.execute(stats_query)
        stats_row = cursor.fetchone()
        
        total_calls = int(stats_row[0]) if stats_row[0] else 0
        total_drivers = int(stats_row[1]) if stats_row[1] else 0
        total_carriers = int(stats_row[2]) if stats_row[2] else 0
        missed_calls = int(stats_row[3]) if stats_row[3] else 0
        answered_calls = max(total_calls - missed_calls, 0)
        answered_rate = round((answered_calls / total_calls) * 100, 2) if total_calls else 0.0
        
        # Reason chart query
        reason_chart_query = f"""
            SELECT 
                CASE 
                    WHEN reason_text IS NULL OR LTRIM(RTRIM(reason_text)) = '' THEN 'Unknown'
                    ELSE reason_text
                END AS reason_text,
                COUNT(DISTINCT hl.id) AS count
            {base_where}
            GROUP BY CASE 
                WHEN reason_text IS NULL OR LTRIM(RTRIM(reason_text)) = '' THEN 'Unknown'
                ELSE reason_text
            END
            ORDER BY count DESC
        """
        
        cursor.execute(reason_chart_query)
        reason_rows = cursor.fetchall()
        
        reason_chart = [
            {
                "reason_text": normalize_text(row[0]),
                "count": int(row[1]) if row[1] else 0
            }
            for row in reason_rows
        ]
        
        # Top drivers query
        top_drivers_query = f"""
            SELECT TOP 10
                CASE 
                    WHEN person_name IS NULL OR LTRIM(RTRIM(person_name)) = '' THEN 'Unknown'
                    ELSE person_name
                END AS person_name,
                COUNT(DISTINCT hl.id) AS count
            {base_where}
            GROUP BY CASE 
                WHEN person_name IS NULL OR LTRIM(RTRIM(person_name)) = '' THEN 'Unknown'
                ELSE person_name
            END
            ORDER BY count DESC
        """
        
        cursor.execute(top_drivers_query)
        driver_rows = cursor.fetchall()
        
        top_drivers = [
            {
                "person_name": normalize_text(row[0]),
                "count": int(row[1]) if row[1] else 0
            }
            for row in driver_rows
        ]
        
        # Top carriers query
        top_carriers_query = f"""
            SELECT TOP 10
                CASE 
                    WHEN carrier_name IS NULL OR LTRIM(RTRIM(carrier_name)) = '' THEN 'Unknown'
                    ELSE carrier_name
                END AS carrier_name,
                COUNT(DISTINCT hl.id) AS count
            {base_where}
            GROUP BY CASE 
                WHEN carrier_name IS NULL OR LTRIM(RTRIM(carrier_name)) = '' THEN 'Unknown'
                ELSE carrier_name
            END
            ORDER BY count DESC
        """
        
        cursor.execute(top_carriers_query)
        carrier_rows = cursor.fetchall()
        
        top_carriers = [
            {
                "carrier_name": normalize_text(row[0]),
                "count": int(row[1]) if row[1] else 0
            }
            for row in carrier_rows
        ]
        
        logger.info("📊 Statistics calculated:")
        logger.info(f"   Total Calls: {total_calls}")
        logger.info(f"   Total Drivers: {total_drivers}")
        logger.info(f"   Total Carriers: {total_carriers}")
        logger.info(f"   Answered Calls: {answered_calls} ({answered_rate}%)")
        logger.info(f"   Reason Chart items: {len(reason_chart)}")
        logger.info(f"   Top Drivers items: {len(top_drivers)}")
        logger.info(f"   Top Carriers items: {len(top_carriers)}")
        
        response = {
            "totalCalls": total_calls,
            "totalDrivers": total_drivers,
            "totalCarriers": total_carriers,
            "answeredRate": answered_rate,
            "reasonChart": reason_chart,
            "topDrivers": top_drivers,
            "topCarriers": top_carriers,
        }
        
        logger.info(f"📤 Sending response with reasonChart length: {len(reason_chart)}")
        return JSONResponse(content=response)
        
    except Exception as error:
        logger.error(f"❌ Database error: {error}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to fetch dashboard data",
                "message": str(error)
            }
        )
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.get("/api/reports/alerts-call")
async def get_alerts_call_report(
    date: Optional[str] = None,
    reason: Optional[str] = None,
    carrier: Optional[str] = None,
    fleet: Optional[str] = None,
    driver: Optional[str] = None,
    page: int = 1,
    limit: int = 20
):
    """
    Get Alerts Call Report (prompt_id = 2) with filters and pagination
    
    Query Parameters:
        date: Filter by date (yyyy-MM-dd), default: today
        reason: Filter by reason_text
        carrier: Filter by carrier_name
        fleet: Filter by fleet_name
        driver: Filter by person_name
        page: Page number (default: 1)
        limit: Items per page (default: 20)
    
    Returns:
        {
            "data": List of call records,
            "total": Total count of records,
            "page": Current page,
            "limit": Items per page,
            "total_pages": Total number of pages
        }
    """
    connection = None
    cursor = None
    
    try:
        # Validate pagination
        page = max(1, page)
        limit = max(1, min(100, limit))  # Limit between 1 and 100
        
        # Build cache key
        cache_key = f"alerts-call:{date or 'today'}:{reason or ''}:{carrier or ''}:{fleet or ''}:{driver or ''}:{page}:{limit}"
        current_time = time()
        
        # Check cache
        if cache_key in _report_cache:
            cached_data, cache_timestamp = _report_cache[cache_key]
            if current_time - cache_timestamp < _cache_ttl:
                logger.info(f"📦 Cache hit for alerts call report: {cache_key}")
                return JSONResponse(content=cached_data)
        
        logger.info("📊 Alerts Call Report API called - Connecting to Azure SQL...")
        
        conn_str = get_sql_connection_string()
        connection = pyodbc.connect(conn_str, timeout=30)
        cursor = connection.cursor()
        logger.info("✅ Connected to Azure SQL successfully")
        
        # Build WHERE clause with filters (using parameterized query)
        where_conditions = []
        params = []
        
        # Prompt ID filter
        where_conditions.append("prompt_id = ?")
        params.append(2)
        
        # Date filter (default: today) - use created_at with UTC+7
        if date:
            filter_date = date
        else:
            filter_date = datetime.now().strftime('%Y-%m-%d')
        
        where_conditions.append("CAST(DATEADD(HOUR, 7, CAST(hl.created_at AS datetime2)) AS DATE) = ?")
        params.append(filter_date)
        
        if reason and reason.strip():
            clean_reason = reason.strip()
            where_conditions.append("LTRIM(RTRIM(reason_text)) = ?")
            params.append(clean_reason)
            logger.info(f"🔍 Adding reason filter: {reason.strip()}")
        if carrier and carrier.strip():
            clean_carrier = carrier.strip()
            where_conditions.append("LTRIM(RTRIM(carrier_name)) = ?")
            params.append(clean_carrier)
            logger.info(f"🔍 Adding carrier filter: {clean_carrier}")
        if fleet and fleet.strip():
            clean_fleet = fleet.strip()
            where_conditions.append("LTRIM(RTRIM(pb.fleet_name)) = ?")
            params.append(clean_fleet)
            logger.info(f"🔍 Adding fleet filter: {clean_fleet}")
        if driver and driver.strip():
            clean_driver = driver.strip()
            where_conditions.append("LTRIM(RTRIM(person_name)) = ?")
            params.append(clean_driver)
            logger.info(f"🔍 Adding driver filter: {clean_driver}")
        
        where_clause = " AND ".join(where_conditions)
        
        logger.info(f"📝 WHERE clause: {where_clause}")
        logger.info(f"📝 Parameters: {params}")
        
        # First, get total count
        count_query = f"""
            SELECT COUNT(*)
            FROM [sqldb-scgjwd-voicebot-prd].dbo.vb_history_log hl
            LEFT JOIN [sqldb-scgjwd-voicebot-prd].dbo.vb_hangup_message_master hm ON hl.hangup_code = hm.hangup_code
            LEFT JOIN (
                SELECT 
                    personal_phone_number,
                    MAX(fleet_id) AS fleet_id,
                    MAX(fleet_name) AS fleet_name
                FROM dbo.vb_phonebook_master
                WHERE personal_phone_number IS NOT NULL
                GROUP BY personal_phone_number
            ) pb ON hl.phone_number = pb.personal_phone_number
            WHERE {where_clause}
        """
        
        cursor.execute(count_query, params)
        total_count = cursor.fetchone()[0]
        
        # Calculate pagination
        offset = (page - 1) * limit
        total_pages = (total_count + limit - 1) // limit  # Ceiling division
        
        # Main query with pagination
        query = f"""
            SELECT 
                hl.id,
                vehicle_plate, 
                person_name,
                history,
                reason_text,
                FORMAT(CAST(start_call AS datetime2), 'yyyy-MM-dd HH:mm:ss') AS start_call,
                FORMAT(CAST(end_call AS datetime2), 'yyyy-MM-dd HH:mm:ss') AS end_call,
                duration, 
                latitude, 
                longitude,
                FORMAT(DATEADD(HOUR, 7, CAST(hl.created_at AS datetime2)), 'yyyy-MM-dd HH:mm:ss') AS created_at,
                hl.created_by,
                phone_number,
                reason_id,
                session_id,
                kubsave_comment_gps_id, 
                kubsave_notification_id,
                hl.kubsave_event_location, 
                hl.kubsave_event_name,
                carrier_code, 
                carrier_name,
                is_hangup, 
                is_personal_phone_call,
                prompt_id, 
                is_call_transferred, 
                transferred_to_number,
                hl.hangup_code, 
                hm.threecx_hangup_message,
                hm.hangup_message,
                answer_duration/1000 as answer_duration_second,
                FORMAT(DATEADD(HOUR, 7, CAST(answer_start AS datetime2)), 'yyyy-MM-dd HH:mm:ss') AS answer_start,
                FORMAT(DATEADD(HOUR, 7, CAST(answer_end AS datetime2)), 'yyyy-MM-dd HH:mm:ss') AS answer_end,
                pb.fleet_id, 
                pb.fleet_name,
                DATEDIFF(SECOND, answer_start, hl.created_at) AS duration_from_start_second,
                RIGHT('0' + CAST(DATEDIFF(SECOND, answer_start, hl.created_at) / 3600 AS VARCHAR(2)), 2)
                    + ':' +
                    RIGHT('0' + CAST((DATEDIFF(SECOND, answer_start, hl.created_at) % 3600) / 60 AS VARCHAR(2)), 2)
                    + ':' +
                    RIGHT('0' + CAST(DATEDIFF(SECOND, answer_start, hl.created_at) % 60 AS VARCHAR(2)), 2)
                    AS duration_from_start_formattime
            FROM [sqldb-scgjwd-voicebot-prd].dbo.vb_history_log hl
            LEFT JOIN [sqldb-scgjwd-voicebot-prd].dbo.vb_hangup_message_master hm ON hl.hangup_code = hm.hangup_code
            LEFT JOIN (
                SELECT 
                    personal_phone_number,
                    MAX(fleet_id) AS fleet_id,
                    MAX(fleet_name) AS fleet_name
                FROM dbo.vb_phonebook_master
                WHERE personal_phone_number IS NOT NULL
                GROUP BY personal_phone_number
            ) pb ON hl.phone_number = pb.personal_phone_number
            WHERE {where_clause}
            ORDER BY CAST(hl.created_at AS DATE) DESC
            OFFSET ? ROWS
            FETCH NEXT ? ROWS ONLY
        """
        
        # Add pagination parameters
        query_params = params + [offset, limit]
        
        cursor.execute(query, query_params)
        rows = cursor.fetchall()
        
        # Get column names
        columns = [column[0] for column in cursor.description]
        
        # Convert to list of dictionaries
        results = []
        for row in rows:
            record = {}
            for i, col in enumerate(columns):
                value = row[i]
                # Convert None to null for JSON
                if value is None:
                    record[col] = None
                elif isinstance(value, Decimal):
                    # Convert Decimal to float for JSON serialization
                    record[col] = float(value)
                elif hasattr(value, 'isoformat'):  # Check if it's a datetime/date object
                    # Convert datetime/date to string
                    record[col] = value.isoformat()
                else:
                    record[col] = value
            results.append(record)
        
        # Build response
        response_data = {
            "data": results,
            "total": total_count,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }
        
        # Cache the result
        _report_cache[cache_key] = (response_data, current_time)
        
        # Clean old cache entries (keep only last 100 entries)
        if len(_report_cache) > 100:
            # Remove oldest entries
            sorted_cache = sorted(_report_cache.items(), key=lambda x: x[1][1])
            for key, _ in sorted_cache[:-100]:
                del _report_cache[key]
        
        logger.info(f"📊 Alerts Call Report: {len(results)}/{total_count} records (page {page}/{total_pages})")
        logger.info(f"🔍 Filters applied: date={date}, reason={reason}, carrier={carrier}, fleet={fleet}, driver={driver}")
        logger.info(f"📝 WHERE clause: {where_clause}")
        logger.info(f"📝 Parameters: {params}")
        return JSONResponse(content=response_data)
        
    except Exception as error:
        logger.error(f"❌ Database error in alerts call report: {error}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to fetch alerts call report",
                "message": str(error)
            }
        )
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.get("/api/reports/web-call")
async def get_web_call_report(
    date: str = None,
    reason: str = None,
    carrier: str = None,
    fleet: str = None,
    driver: str = None
):
    """
    Get Web Call Report (prompt_id = 3) with filters
    
    Query Parameters:
        date: Filter by date (yyyy-MM-dd), default: today
        reason: Filter by reason_text
        carrier: Filter by carrier_name
        fleet: Filter by fleet_name
        driver: Filter by person_name
    
    Returns:
        List of call records with all fields
    """
    connection = None
    cursor = None
    
    try:
        logger.info("📊 Web Call Report API called - Connecting to Azure SQL...")
        
        conn_str = get_sql_connection_string()
        connection = pyodbc.connect(conn_str, timeout=30)
        cursor = connection.cursor()
        logger.info("✅ Connected to Azure SQL successfully")
        
        # Build WHERE clause with filters (using parameterized query)
        where_conditions = []
        params = []
        
        # Prompt ID filter
        where_conditions.append("prompt_id = ?")
        params.append(3)
        
        # Date filter (default: today)
        if date:
            filter_date = date
        else:
            filter_date = datetime.now().strftime('%Y-%m-%d')
        
        where_conditions.append("CAST(CONVERT(VARCHAR(10), CAST(start_call AS datetime), 120) AS DATE) = ?")
        params.append(filter_date)
        
        if reason:
            where_conditions.append("reason_text = ?")
            params.append(reason)
        if carrier:
            where_conditions.append("carrier_name = ?")
            params.append(carrier)
        if fleet:
            where_conditions.append("pb.fleet_name = ?")
            params.append(fleet)
        if driver:
            where_conditions.append("person_name = ?")
            params.append(driver)
        
        where_clause = " AND ".join(where_conditions)
        
        query = f"""
            SELECT 
                hl.id, 
                vehicle_plate, 
                person_name,
                history,
                reason_text,
                CONVERT(VARCHAR(19), CAST(start_call AS datetime), 120) AS start_call,
                CONVERT(VARCHAR(19), CAST(end_call AS datetime), 120) AS end_call,
                duration, 
                latitude, 
                longitude,
                CONVERT(VARCHAR(19), DATEADD(HOUR, 7, CAST(hl.created_at AS datetime)), 120) AS created_at,
                hl.created_by,
                phone_number,
                reason_id,
                session_id,
                kubsave_comment_gps_id, 
                kubsave_notification_id,
                hl.kubsave_event_location, 
                hl.kubsave_event_name,
                carrier_code, 
                carrier_name,
                is_hangup, 
                is_personal_phone_call,
                prompt_id, 
                is_call_transferred, 
                transferred_to_number,
                hl.hangup_code, 
                hm.threecx_hangup_message,
                hm.hangup_message,
                CAST(answer_duration/1000.0 AS FLOAT) as answer_duration_second,
                CONVERT(VARCHAR(19), CAST(answer_start AS datetime), 120) AS answer_start, 
                CONVERT(VARCHAR(19), CAST(answer_end AS datetime), 120) AS answer_end,
                pb.fleet_id, 
                pb.fleet_name
            FROM [sqldb-scgjwd-voicebot-prd].dbo.vb_history_log hl
            LEFT JOIN [sqldb-scgjwd-voicebot-prd].dbo.vb_hangup_message_master hm ON hl.hangup_code = hm.hangup_code
            LEFT JOIN (
                SELECT 
                    personal_phone_number,
                    MAX(fleet_id) AS fleet_id,
                    MAX(fleet_name) AS fleet_name
                FROM dbo.vb_phonebook_master
                WHERE personal_phone_number IS NOT NULL
                GROUP BY personal_phone_number
            ) pb ON hl.phone_number = pb.personal_phone_number
            WHERE {where_clause}
            ORDER BY CAST(hl.created_at AS DATE) DESC
        """
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Get column names
        columns = [column[0] for column in cursor.description]
        
        # Convert to list of dictionaries
        results = []
        for row in rows:
            record = {}
            for i, col in enumerate(columns):
                value = row[i]
                # Convert None to null for JSON
                if value is None:
                    record[col] = None
                elif isinstance(value, Decimal):
                    # Convert Decimal to float for JSON serialization
                    record[col] = float(value)
                elif hasattr(value, 'isoformat'):  # Check if it's a datetime/date object
                    # Convert datetime/date to string
                    record[col] = value.isoformat()
                else:
                    record[col] = value
            results.append(record)
        
        logger.info(f"📊 Web Call Report: {len(results)} records (filters: date={date}, reason={reason}, carrier={carrier}, fleet={fleet}, driver={driver})")
        return JSONResponse(content=results)
        
    except Exception as error:
        logger.error(f"❌ Database error in web call report: {error}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to fetch web call report",
                "message": str(error)
            }
        )
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.get("/api/reports/filters")
async def get_report_filters():
    """
    Get filter options for Web Call Report
    
    Returns:
        {
            "reasons": List[str],
            "carriers": List[str],
            "fleets": List[str],
            "drivers": List[str]
        }
    """
    connection = None
    cursor = None
    
    try:
        logger.info("📊 Report Filters API called - Connecting to Azure SQL...")
        
        conn_str = get_sql_connection_string()
        connection = pyodbc.connect(conn_str, timeout=30)
        cursor = connection.cursor()
        logger.info("✅ Connected to Azure SQL successfully")
        
        # Get distinct values for filters
        filters_query = """
            SELECT DISTINCT
                LTRIM(RTRIM(reason_text)) AS reason_text_clean,
                LTRIM(RTRIM(carrier_name)) AS carrier_name_clean,
                LTRIM(RTRIM(pb.fleet_name)) AS fleet_name_clean,
                LTRIM(RTRIM(person_name)) AS person_name_clean
            FROM [sqldb-scgjwd-voicebot-prd].dbo.vb_history_log hl
            LEFT JOIN (
                SELECT 
                    personal_phone_number,
                    MAX(fleet_name) AS fleet_name
                FROM dbo.vb_phonebook_master
                WHERE personal_phone_number IS NOT NULL
                GROUP BY personal_phone_number
            ) pb ON hl.phone_number = pb.personal_phone_number
            WHERE prompt_id = 2
            AND reason_text IS NOT NULL
            AND carrier_name IS NOT NULL
            AND person_name IS NOT NULL
        """
        
        cursor.execute(filters_query)
        rows = cursor.fetchall()
        
        reasons = set()
        carriers = set()
        fleets = set()
        drivers = set()
        
        for row in rows:
            reason_val, carrier_val, fleet_val, driver_val = row
            if reason_val:
                reasons.add(reason_val)
            if carrier_val:
                carriers.add(carrier_val)
            if fleet_val:
                fleets.add(fleet_val)
            if driver_val:
                drivers.add(driver_val)
        
        result = {
            "reasons": sorted(list(reasons)),
            "carriers": sorted(list(carriers)),
            "fleets": sorted(list(fleets)),
            "drivers": sorted(list(drivers))
        }
        
        logger.info(f"📊 Report Filters: {len(result['reasons'])} reasons, {len(result['carriers'])} carriers, {len(result['fleets'])} fleets, {len(result['drivers'])} drivers")
        return JSONResponse(content=result)
        
    except Exception as error:
        logger.error(f"❌ Database error in report filters: {error}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to fetch report filters",
                "message": str(error)
            }
        )
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


# ============================================================================
# TTS API Proxy Endpoint
# ============================================================================

def detect_chinese(text: str) -> bool:
    """
    Detect if text contains Chinese characters
    Chinese Unicode ranges:
    - CJK Unified Ideographs: U+4E00-U+9FFF
    - CJK Extension A: U+3400-U+4DBF
    - CJK Extension B: U+20000-U+2A6DF
    - CJK Extension C: U+2A700-U+2B73F
    - CJK Extension D: U+2B740-U+2B81F
    - CJK Extension E: U+2B820-U+2CEAF
    - CJK Compatibility Ideographs: U+F900-U+FAFF
    """
    for char in text:
        code_point = ord(char)
        # Check main CJK ranges
        if (0x4E00 <= code_point <= 0x9FFF or  # CJK Unified Ideographs
            0x3400 <= code_point <= 0x4DBF or  # CJK Extension A
            0xF900 <= code_point <= 0xFAFF):   # CJK Compatibility Ideographs
            return True
    return False


class TTSRequest(BaseModel):
    text: str
    speaker: Optional[str] = "1"
    volume: Optional[float] = 1.0
    speed: Optional[float] = 1.0
    type_media: Optional[str] = "wav"
    language: Optional[str] = "th"


@app.options("/api/tts")
async def options_tts():
    """Handle CORS preflight for TTS API"""
    logger.info("🔊 OPTIONS request received for /api/tts")
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )


@app.post("/api/tts")
async def proxy_tts_api(request: TTSRequest):
    """
    Proxy endpoint for TTS API
    Frontend calls this endpoint instead of calling TTS API directly
    This avoids CORS issues and keeps API keys secure on the backend
    
    Automatically detects Chinese text and sets language to "zh" if Chinese is detected.
    """
    try:
        # Get TTS API URL from environment (ใช้ VITE_TTS_API ที่มีอยู่แล้ว)
        tts_api_url = os.getenv(
            "VITE_TTS_API", 
            "https://voice-tts.botnoi.ai/scgjwd/api/doctts"
        )
        
        # Get API keys from environment (secure, not exposed to frontend)
        headers = {
            "Content-Type": "application/json",
            "Accept": "*/*",
        }
        
        # Add authentication headers (ใช้ VITE_X_API_KEY และ VITE_API_KEY ที่มีอยู่แล้ว)
        if os.getenv("VITE_X_API_KEY"):
            headers["x-api-key"] = os.getenv("VITE_X_API_KEY")
        if os.getenv("VITE_API_KEY"):
            headers["key"] = os.getenv("VITE_API_KEY")
        
        # Auto-detect Chinese and override language if Chinese is detected
        detected_language = request.language
        if detect_chinese(request.text):
            detected_language = "zh"
            logger.info(f"🔊 TTS: Detected Chinese text, setting language to 'zh'")
        
        # Prepare payload
        payload = {
            "text": request.text,
            "speaker": request.speaker,
            "volume": request.volume,
            "speed": request.speed,
            "type_media": request.type_media,
            "language": detected_language,
        }
        
        logger.info(f"🔊 TTS Proxy: Calling {tts_api_url}")
        logger.info(f"🔊 TTS Payload: text length={len(request.text)}")
        
        # Make request to TTS API using httpx (async HTTP client)
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                tts_api_url,
                json=payload,
                headers=headers,
            )
            
            # Check if response is successful
            response.raise_for_status()
            
            # Get content type
            content_type = response.headers.get("content-type", "")
            
            # If response is audio file (binary), return it directly
            if content_type.startswith("audio/") or "wav" in content_type or "mp3" in content_type:
                logger.info(f"✅ TTS Proxy: Received audio file ({content_type})")
                return Response(
                    content=response.content,
                    media_type=content_type,
                    headers={
                        "Content-Type": content_type,
                        "Content-Disposition": f'attachment; filename="tts_audio.{request.type_media}"'
                    }
                )
            
            # If response is JSON, parse and return
            try:
                json_data = response.json()
                logger.info(f"✅ TTS Proxy: Received JSON response")
                return JSONResponse(content=json_data)
            except:
                # If not JSON, return as text
                logger.info(f"✅ TTS Proxy: Received text response")
                return Response(
                    content=response.text,
                    media_type="text/plain"
                )
                
    except httpx.HTTPStatusError as e:
        logger.error(f"❌ TTS Proxy HTTP Error: {e.response.status_code} - {e.response.text}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail={
                "error": "TTS API returned an error",
                "message": e.response.text[:500] if e.response.text else str(e)
            }
        )
    except httpx.RequestError as e:
        logger.error(f"❌ TTS Proxy Request Error: {e}")
        raise HTTPException(
            status_code=502,
            detail={
                "error": "Failed to connect to TTS API",
                "message": str(e)
            }
        )
    except Exception as e:
        logger.error(f"❌ TTS Proxy Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal server error in TTS proxy",
                "message": str(e)
            }
        )


# ============================================================================
# Phone Call API Proxy Endpoint
# ============================================================================

class PhoneCallRequest(BaseModel):
    number: str  # Can be string to preserve leading zeros
    message: str
    phone_number: Optional[str] = None
    prompt_id: Optional[int] = 3


@app.options("/api/phone-call")
async def options_phone_call():
    """Handle CORS preflight for Phone Call API"""
    logger.info("📞 OPTIONS request received for /api/phone-call")
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )


@app.post("/api/phone-call")
async def proxy_phone_call_api(request: PhoneCallRequest):
    """
    Proxy endpoint for Phone Call API
    Frontend calls this endpoint instead of calling Phone Call API directly
    This avoids CORS issues and mixed content (HTTP/HTTPS) problems
    """
    logger.info("📞 POST request received for /api/phone-call")
    logger.info(f"📞 Request body: {request}")
    try:
        # Get Phone Call API URL from environment (ใช้ VITE_PHONE_CALL_API ที่มีอยู่แล้ว)
        phone_call_api_url = os.getenv(
            "VITE_PHONE_CALL_API",
            "https://api-voicebot.scgjwd.com/api/queue/customer/add_queue"
        )
        
        # Prepare headers
        headers = {
            "Content-Type": "application/json",
        }
        
        # Add authentication if needed
        if os.getenv("PHONE_CALL_TOKEN"):
            token = os.getenv("PHONE_CALL_TOKEN")
            headers["Authorization"] = token if token.startswith("Bearer") else f"Bearer {token}"
        elif os.getenv("VITE_PHONE_CALL_TOKEN"):
            token = os.getenv("VITE_PHONE_CALL_TOKEN")
            headers["Authorization"] = token if token.startswith("Bearer") else f"Bearer {token}"
        elif os.getenv("VITE_API_TOKEN"):
            token = os.getenv("VITE_API_TOKEN")
            headers["Authorization"] = token if token.startswith("Bearer") else f"Bearer {token}"
        
        # Prepare payload - ensure phone numbers are strings to preserve leading zeros
        # New structure: no person_name, prompt_id is number
        payload = {
            "number": str(request.number),
            "message": request.message,
            "phone_number": str(request.phone_number) if request.phone_number else str(request.number),
            "prompt_id": request.prompt_id if request.prompt_id is not None else 3,
        }
        
        logger.info(f"📞 Phone Call Proxy: Calling {phone_call_api_url}")
        logger.info(f"📞 Phone Call Payload: number={payload['number']}, message length={len(payload['message'])}")
        logger.info(f"📞 Phone Call Headers: {headers}")
        logger.info(f"📞 Full Payload: {payload}")
        
        # Make request to Phone Call API using httpx (async HTTP client)
        # Set verify=False for HTTP connections (not HTTPS) to avoid SSL issues
        # Set follow_redirects=True to handle redirects
        # Increase timeout and add connection pool settings for better reliability
        # Use custom DNS resolver if needed (for Azure App Service DNS issues)
        timeout_config = httpx.Timeout(
            connect=30.0,  # Time to establish connection
            read=60.0,     # Time to read response
            write=30.0,    # Time to write request
            pool=30.0      # Time to get connection from pool
        )
        # Extract hostname and use IP address directly for known domains to avoid DNS issues
        import socket
        hostname = phone_call_api_url.split('//')[1].split('/')[0].split(':')[0]
        ip_address = None
        
        # For api-voicebot.scgjwd.com, use IP address directly to avoid DNS resolution issues in Azure
        # Azure App Service has DNS resolution issues, so we bypass DNS by using IP directly
        if hostname == "api-voicebot.scgjwd.com":
            # Use Cloudflare IP directly (Azure App Service may have DNS resolution issues)
            # Try both IPs in case one doesn't work
            ip_address = "104.18.22.41"  # Primary IP
            logger.info(f"📞 Bypassing DNS: Using hardcoded IP {ip_address} for {hostname}")
            logger.info(f"📞 This will avoid DNS resolution issues in Azure App Service")
        else:
            # Try to resolve hostname for other domains
            try:
                logger.info(f"📞 Resolving hostname: {hostname}")
                ip_address = socket.gethostbyname(hostname)
                logger.info(f"📞 Resolved {hostname} to {ip_address}")
            except (socket.gaierror, OSError) as dns_error:
                logger.warning(f"⚠️ DNS resolution failed for {hostname}: {dns_error}")
                logger.warning(f"⚠️ Will try httpx DNS resolution")
        
        # If we have IP address (from DNS or hardcoded), use IP directly to avoid DNS issues
        # When using IP address with HTTPS, we need to disable SSL verification because
        # the certificate is issued for the hostname, not the IP address
        if ip_address:
            logger.info(f"📞 Using IP address {ip_address} for {hostname} to avoid DNS issues")
            url_parts = phone_call_api_url.split('//')
            if len(url_parts) > 1:
                path = '/' + '/'.join(url_parts[1].split('/')[1:])
                ip_url = f"{url_parts[0]}//{ip_address}{path}"
                logger.info(f"📞 Making POST request to IP URL: {ip_url}")
                # Add Host header for SNI (Server Name Indication) - required for SSL/TLS
                headers_with_host = headers.copy()
                headers_with_host['Host'] = hostname
                logger.info(f"📞 Using Host header: {hostname} for SNI")
                
                # When using IP address directly, SSL certificate verification will fail
                # because the certificate is issued for the hostname, not the IP
                # So we disable SSL verification but keep the Host header for SNI
                logger.warning(f"⚠️ Disabling SSL verification when using IP address (certificate is for hostname)")
                try:
                    async with httpx.AsyncClient(
                        timeout=timeout_config,
                        verify=False,  # Disable SSL verification when using IP address
                        follow_redirects=True,
                        limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
                    ) as client:
                        logger.info(f"📞 Attempting connection to {ip_url} with Host: {hostname}")
                        response = await client.post(
                            ip_url,
                            json=payload,
                            headers=headers_with_host,
                        )
                        logger.info(f"✅ Successfully connected using IP address")
                except (httpx.ConnectError, httpx.ConnectTimeout) as ip_error:
                    error_str = str(ip_error)
                    logger.error(f"❌ Failed to connect using IP {ip_address}: {error_str}")
                    
                    # If SSL handshake fails even with verify=False, it might be:
                    # 1. Firewall blocking the connection
                    # 2. Server rejecting connections from IP address directly
                    # 3. SNI issue - server requires proper hostname in SNI
                    if "handshake" in error_str.lower() or "ssl" in error_str.lower():
                        logger.warning(f"⚠️ SSL handshake failed even with verify=False")
                        logger.warning(f"⚠️ This might be due to firewall or server rejecting IP-based connections")
                        logger.warning(f"⚠️ Trying alternative: use hostname with DNS override via /etc/hosts (not possible in Azure)")
                        logger.warning(f"⚠️ Or: server might require proper SNI with hostname, not IP")
                        
                        # Last resort: try with original hostname but with verify=False
                        # This might work if DNS resolution works but SSL cert verification fails
                        logger.warning(f"⚠️ Attempting fallback: use original URL with verify=False")
                        try:
                            async with httpx.AsyncClient(
                                timeout=timeout_config,
                                verify=False,  # Disable SSL verification
                                follow_redirects=True,
                                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
                            ) as fallback_client:
                                # Try original URL - if DNS works but SSL fails, this might work
                                logger.info(f"📞 Fallback: Trying original URL {phone_call_api_url} with verify=False")
                                response = await fallback_client.post(
                                    phone_call_api_url,
                                    json=payload,
                                    headers=headers,
                                )
                                logger.info(f"✅ Fallback successful with original URL")
                        except Exception as fallback_error:
                            logger.error(f"❌ Fallback also failed: {fallback_error}")
                            raise ip_error  # Re-raise original error
                    else:
                        raise
            else:
                # Fallback to original URL if URL parsing fails
                logger.warning(f"⚠️ URL parsing failed, using original URL")
                async with httpx.AsyncClient(
                    timeout=timeout_config,
                    verify=True,
                    follow_redirects=True,
                    limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
                ) as client:
                    response = await client.post(
                        phone_call_api_url,
                        json=payload,
                        headers=headers,
                    )
        else:
            # No IP address, try original URL with normal SSL verification
            logger.warning(f"⚠️ No IP address available, trying original URL (may fail due to DNS)")
            logger.info(f"📞 Making POST request to {phone_call_api_url}")
            async with httpx.AsyncClient(
                timeout=timeout_config,
                verify=True,  # Enable SSL verification for HTTPS
                follow_redirects=True,
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
            ) as client:
                response = await client.post(
                    phone_call_api_url,
                    json=payload,
                    headers=headers,
                )
        
        # Process response (common for all paths)
        logger.info(f"📞 Response status: {response.status_code}")
        logger.info(f"📞 Response headers: {dict(response.headers)}")
        
        # Check if response is successful
        response.raise_for_status()
        
        # Try to parse JSON response
        try:
            json_data = response.json()
            logger.info(f"✅ Phone Call Proxy: Success - {json_data}")
            return JSONResponse(content=json_data)
        except:
            # If not JSON, return text
            logger.info(f"✅ Phone Call Proxy: Success - {response.text}")
            return JSONResponse(content={"status": "success", "message": response.text})
                
    except httpx.HTTPStatusError as e:
        logger.error(f"❌ Phone Call Proxy HTTP Error: {e.response.status_code} - {e.response.text}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail={
                "error": "Phone Call API returned an error",
                "message": e.response.text[:500] if e.response.text else str(e)
            }
        )
    except httpx.RequestError as e:
        error_msg = str(e)
        error_type = type(e).__name__
        logger.error(f"❌ Phone Call Proxy Request Error: {error_msg}")
        logger.error(f"   Phone Call API URL: {phone_call_api_url}")
        logger.error(f"   Error type: {error_type}")
        logger.error(f"   Error details: {repr(e)}")
        
        # Provide more detailed error message based on error type
        if isinstance(e, httpx.ConnectError):
            if "Name resolution failed" in error_msg or "getaddrinfo failed" in error_msg:
                detailed_msg = f"Cannot resolve hostname for {phone_call_api_url}. Please check if the URL is correct and DNS is working."
            elif "Connection refused" in error_msg or "Connection reset" in error_msg:
                detailed_msg = f"Cannot connect to {phone_call_api_url}. The server may be down, firewall is blocking, or not accessible from Azure App Service network. Azure App Service may not have outbound access to this IP address."
            else:
                detailed_msg = f"Connection error: {error_msg}. This may be a network/firewall issue between Azure and the Phone Call API server."
        elif isinstance(e, httpx.TimeoutException):
            detailed_msg = f"Connection timeout to {phone_call_api_url}. The server may be slow or unreachable. Timeout is set to 60 seconds."
        elif isinstance(e, httpx.NetworkError):
            detailed_msg = f"Network error: {error_msg}. Azure App Service may not be able to reach {phone_call_api_url} due to network restrictions or firewall rules."
        else:
            detailed_msg = f"Request error: {error_msg}"
        
        raise HTTPException(
            status_code=502,
            detail={
                "error": "Failed to connect to Phone Call API",
                "message": detailed_msg,
                "api_url": phone_call_api_url,
                "error_type": error_type
            }
        )
    except Exception as e:
        logger.error(f"❌ Phone Call Proxy Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal server error in Phone Call proxy",
                "message": str(e)
            }
        )


if __name__ == "__main__":
    import uvicorn
    
    # Azure App Service uses PORT environment variable
    port = int(os.getenv("PORT", 8000))
    workers = int(os.getenv("WORKERS", 2))
    
    print("=" * 50)
    print(f"🚀 Dashboard API server starting on port {port}")
    print(f"📡 Access dashboard at: http://localhost:{port}/api/dashboard")
    print(f"👥 Workers: {workers}")
    print("=" * 50)
    print("⚠️  Make sure you have set these environment variables:")
    print("   - AZURE_SQL_USER")
    print("   - AZURE_SQL_PASSWORD")
    print("   - AZURE_SQL_SERVER")
    print("   - AZURE_SQL_DATABASE")
    print("   - AZURE_SQL_PORT (optional, default: 1433)")
    print("   - PORT (optional, default: 8000)")
    print("=" * 50)
    
    # Use workers for production, single worker (with reload) for development
    if os.getenv("ENVIRONMENT") == "production":
        uvicorn.run(app, host="0.0.0.0", port=port, workers=workers)
    else:
        # Use import string when enabling reload to avoid uvicorn warning
        uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

