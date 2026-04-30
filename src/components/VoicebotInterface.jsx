import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Dashboard from './Dashboard'
import CallReports from './CallReports'
import { getBaseApiUrl } from '../config/api'
import './VoicebotInterface.css'

const VoicebotInterface = () => {
  const [activeTab, setActiveTab] = useState('call-interface') // 'call-interface', 'monitoring', or 'call-reports'
  const [message, setMessage] = useState('')
  const [outputMessage, setOutputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [callLoading, setCallLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [audioError, setAudioError] = useState('')
  const [callError, setCallError] = useState('')
  const [showDialPad, setShowDialPad] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')

  // Cleanup object URL เมื่อ component unmount หรือ audioUrl เปลี่ยน
  useEffect(() => {
    return () => {
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  // Helper function สำหรับสร้าง headers สำหรับ InformAgent API
  const getInformAgentHeaders = () => {
    const headers = {
      'Content-Type': 'application/json',
    }

    // Basic Auth สำหรับ InformAgent (ถ้ามี) - จะ override Authorization header อื่นๆ
    if (import.meta.env.VITE_INFORM_AGENT_USER && import.meta.env.VITE_INFORM_AGENT_PASS) {
      const credentials = btoa(`${import.meta.env.VITE_INFORM_AGENT_USER}:${import.meta.env.VITE_INFORM_AGENT_PASS}`)
      headers['Authorization'] = `Basic ${credentials}`
      console.log('✅ Using Basic Auth with username:', import.meta.env.VITE_INFORM_AGENT_USER)
    } else if (import.meta.env.VITE_INFORM_AGENT_TOKEN) {
      // Bearer token สำหรับ InformAgent
      headers['Authorization'] = import.meta.env.VITE_INFORM_AGENT_TOKEN.startsWith('Bearer') 
        ? import.meta.env.VITE_INFORM_AGENT_TOKEN 
        : `Bearer ${import.meta.env.VITE_INFORM_AGENT_TOKEN}`
      console.log('✅ Using Bearer Token for InformAgent')
    } else if (import.meta.env.VITE_API_TOKEN) {
      // Fallback ใช้ Bearer token ทั่วไป
      headers['Authorization'] = import.meta.env.VITE_API_TOKEN.startsWith('Bearer') 
        ? import.meta.env.VITE_API_TOKEN 
        : `Bearer ${import.meta.env.VITE_API_TOKEN}`
      console.log('✅ Using fallback Bearer Token')
    } else if (import.meta.env.VITE_AUTH_TOKEN) {
      headers['Authorization'] = import.meta.env.VITE_AUTH_TOKEN
      console.log('✅ Using VITE_AUTH_TOKEN')
    } else {
      console.warn('⚠️ No authentication headers found! Check .env file')
    }

    console.log('📤 InformAgent Headers:', {
      'Content-Type': headers['Content-Type'],
      'Authorization': headers['Authorization'] ? (headers['Authorization'].startsWith('Basic') ? 'Basic ***' : 'Bearer ***') : 'not set',
    })

    return headers
  }

  // Helper function สำหรับสร้าง headers สำหรับ TTS API
  const getTTSHeaders = () => {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      // หมายเหตุ: ไม่ใส่ Accept-Encoding และ Connection เพราะ browser ควบคุมเอง
      // และจะเกิด error "Refused to set unsafe header" ถ้าพยายามตั้งค่า
    }

    // ตรวจสอบว่าต้องการใช้ custom headers หรือไม่
    // ถ้า VITE_TTS_USE_CUSTOM_HEADERS=true จะใช้ custom headers (จะ trigger CORS preflight)
    // ถ้าไม่ตั้งค่า หรือ false จะใช้ Authorization header แทน
    const useCustomHeaders = import.meta.env.VITE_TTS_USE_CUSTOM_HEADERS === 'true'

    if (useCustomHeaders) {
      // ใช้ custom headers (จะ trigger CORS preflight request)
      // หมายเหตุ: API server ต้องตั้งค่า CORS ให้รองรับ headers เหล่านี้
      if (import.meta.env.VITE_X_API_KEY) {
        headers['x-api-key'] = import.meta.env.VITE_X_API_KEY
      }
      if (import.meta.env.VITE_API_KEY) {
        headers['key'] = import.meta.env.VITE_API_KEY
      }
      console.log('⚠️ Using custom headers (x-api-key, key) - will trigger CORS preflight')
    } else {
      // ใช้ Authorization header แทน custom headers เพื่อหลีกเลี่ยง CORS preflight
      // ถ้า API รองรับ Authorization header
      if (import.meta.env.VITE_X_API_KEY) {
        headers['Authorization'] = `Bearer ${import.meta.env.VITE_X_API_KEY}`
      } else if (import.meta.env.VITE_API_KEY) {
        headers['Authorization'] = `Bearer ${import.meta.env.VITE_API_KEY}`
      } else if (import.meta.env.VITE_API_TOKEN) {
        headers['Authorization'] = import.meta.env.VITE_API_TOKEN.startsWith('Bearer') 
          ? import.meta.env.VITE_API_TOKEN 
          : `Bearer ${import.meta.env.VITE_API_TOKEN}`
      }
      console.log('✅ Using Authorization header - should not trigger CORS preflight')
    }

    console.log('🔊 TTS Headers:', {
      'Content-Type': headers['Content-Type'],
      'Authorization': headers['Authorization'] ? 'Bearer ***' : 'not set',
      'x-api-key': headers['x-api-key'] ? '***' + headers['x-api-key'].slice(-4) : 'not set',
      'key': headers['key'] ? '***' + headers['key'].slice(-4) : 'not set',
      'Accept': headers['Accept'],
    })

    return headers
  }

  // Helper function สำหรับสร้าง query parameters สำหรับ TTS API (fallback)
  const getTTSParams = () => {
    const params = {}
    
    // ลองใช้ query parameters แทน headers เพื่อหลีกเลี่ยง CORS preflight
    // ถ้า API รองรับ query parameters สำหรับ authentication
    if (import.meta.env.VITE_X_API_KEY) {
      params['x-api-key'] = import.meta.env.VITE_X_API_KEY
    }
    if (import.meta.env.VITE_API_KEY) {
      params['key'] = import.meta.env.VITE_API_KEY
    }
    
    return params
  }

  // Helper function สำหรับสร้าง headers สำหรับ Phone Call API
  const getPhoneCallHeaders = () => {
    const headers = {
      'Content-Type': 'application/json',
    }

    // Phone Call API อาจต้องการ Bearer token
    if (import.meta.env.VITE_PHONE_CALL_TOKEN) {
      headers['Authorization'] = import.meta.env.VITE_PHONE_CALL_TOKEN.startsWith('Bearer') 
        ? import.meta.env.VITE_PHONE_CALL_TOKEN 
        : `Bearer ${import.meta.env.VITE_PHONE_CALL_TOKEN}`
    } else if (import.meta.env.VITE_API_TOKEN) {
      headers['Authorization'] = import.meta.env.VITE_API_TOKEN.startsWith('Bearer') 
        ? import.meta.env.VITE_API_TOKEN 
        : `Bearer ${import.meta.env.VITE_API_TOKEN}`
    }

    return headers
  }

  // API 1: Send message and get output
  const handleSendMessage = async () => {
    if (!message.trim()) {
      setStatus('กรุณากรอกข้อความ')
      return
    }

    setLoading(true)
    setStatus('')
    setOutputMessage('')
    setAudioUrl(null)

    try {
      const informAgentUrl = import.meta.env.VITE_INFORM_AGENT_API || 'https://n8n.scgjwd.com/webhook/InformAgent'
      const authHeaders = getInformAgentHeaders()
      
      // สร้าง payload สำหรับ InformAgent API (ต้องมี session_id)
      const sessionId = import.meta.env.VITE_SESSION_ID || '11112' // ใช้ค่า default ถ้าไม่มี env
      
      // ตรวจสอบว่า session_id มีค่าหรือไม่
      if (!sessionId) {
        setStatus('error')
        setOutputMessage('กรุณาตั้งค่า VITE_SESSION_ID ในไฟล์ .env')
        setLoading(false)
        return
      }
      
      const payload = {
        session_id: sessionId,
        message: message.trim()
      }
      
      console.log('📤 Sending request to InformAgent API:', informAgentUrl)
      console.log('📤 Request payload:', payload)
      console.log('📤 Full headers:', authHeaders)
      
      const response = await axios.post(
        informAgentUrl,
        payload,
        {
          headers: authHeaders,
          timeout: 60000, // เพิ่มเป็น 60 seconds timeout (API อาจใช้เวลานาน)
        }
      )

      console.log('API Response:', response.data)
      console.log('API Response Type:', typeof response.data)
      console.log('API Response is Array:', Array.isArray(response.data))
      if (response.data && typeof response.data === 'object') {
        console.log('API Response Keys:', Object.keys(response.data))
      }

      // รองรับ response format หลายแบบ
      if (response.data) {
        // Format 1: [{ output: "..." }]
        if (Array.isArray(response.data) && response.data.length > 0) {
          if (response.data[0].output) {
            setOutputMessage(response.data[0].output)
            setStatus('success')
            return
          }
          // ถ้า array แต่ไม่มี output ลองใช้ element แรกโดยตรง
          if (typeof response.data[0] === 'string') {
            setOutputMessage(response.data[0])
            setStatus('success')
            return
          }
        }
        // Format 2: { output: "..." }
        if (response.data.output) {
          setOutputMessage(response.data.output)
          setStatus('success')
          return
        }
        // Format 3: { message: "..." } หรือ format อื่นๆ
        if (response.data.message) {
          setOutputMessage(response.data.message)
          setStatus('success')
          return
        }
        // Format 4: { text: "..." }
        if (response.data.text) {
          setOutputMessage(response.data.text)
          setStatus('success')
          return
        }
        // Format 5: { data: "..." } หรือ { data: { message: "..." } }
        if (response.data.data) {
          if (typeof response.data.data === 'string') {
            setOutputMessage(response.data.data)
            setStatus('success')
            return
          }
          if (response.data.data.message) {
            setOutputMessage(response.data.data.message)
            setStatus('success')
            return
          }
          if (response.data.data.output) {
            setOutputMessage(response.data.data.output)
            setStatus('success')
            return
          }
        }
        // Format 6: { result: "..." } หรือ { result: { message: "..." } }
        if (response.data.result) {
          if (typeof response.data.result === 'string') {
            setOutputMessage(response.data.result)
            setStatus('success')
            return
          }
          if (response.data.result.message) {
            setOutputMessage(response.data.result.message)
            setStatus('success')
            return
          }
        }
        // Format 7: response.data เป็น string โดยตรง
        if (typeof response.data === 'string') {
          setOutputMessage(response.data)
          setStatus('success')
          return
        }
        // Format 8: ถ้าเป็น object ที่มี property เดียว ลองใช้ค่าของ property นั้น
        if (typeof response.data === 'object' && !Array.isArray(response.data)) {
          const keys = Object.keys(response.data)
          if (keys.length === 1 && typeof response.data[keys[0]] === 'string') {
            setOutputMessage(response.data[keys[0]])
            setStatus('success')
            return
          }
        }
        // Format 9: ถ้าเป็น object ที่มีหลาย properties ลองหา property ที่เป็น string และยาวพอที่จะเป็น message
        if (typeof response.data === 'object' && !Array.isArray(response.data)) {
          const keys = Object.keys(response.data)
          // ลองหา property ที่น่าจะเป็น message (เช่น response, answer, reply, content, body)
          const messageKeys = ['response', 'answer', 'reply', 'content', 'body', 'output_text', 'response_text']
          for (const key of messageKeys) {
            if (response.data[key] && typeof response.data[key] === 'string' && response.data[key].trim().length > 0) {
              setOutputMessage(response.data[key])
              setStatus('success')
              return
            }
          }
          // ถ้าไม่เจอ key ที่รู้จัก ลองหา property แรกที่เป็น string และยาวพอ
          for (const key of keys) {
            if (typeof response.data[key] === 'string' && response.data[key].trim().length > 10) {
              setOutputMessage(response.data[key])
              setStatus('success')
              return
            }
          }
        }
        // Format 10: ถ้าเป็น array of objects ลองหา message ใน object แรก
        if (Array.isArray(response.data) && response.data.length > 0) {
          const firstItem = response.data[0]
          if (typeof firstItem === 'object') {
            // ลองหา property ที่น่าจะเป็น message
            if (firstItem.message && typeof firstItem.message === 'string') {
              setOutputMessage(firstItem.message)
              setStatus('success')
              return
            }
            if (firstItem.text && typeof firstItem.text === 'string') {
              setOutputMessage(firstItem.text)
              setStatus('success')
              return
            }
            if (firstItem.content && typeof firstItem.content === 'string') {
              setOutputMessage(firstItem.content)
              setStatus('success')
              return
            }
          }
        }
      }

      // ถ้าไม่เจอ format ที่รู้จัก - แสดง response ทั้งหมดใน console เพื่อ debug
      console.error('❌ Unknown response format. Full response:', JSON.stringify(response.data, null, 2))
      console.error('❌ Response type:', typeof response.data)
      if (response.data && typeof response.data === 'object') {
        console.error('❌ Response keys:', Object.keys(response.data))
        console.error('❌ Response values:', Object.values(response.data))
      }
      setStatus('error')
      setOutputMessage('ไม่สามารถรับข้อความตอบกลับได้ - รูปแบบข้อมูลไม่ถูกต้อง (ดู Console สำหรับรายละเอียด)')
    } catch (error) {
      console.error('Error sending message:', error)
      
      let errorMessage = 'เกิดข้อผิดพลาดในการส่งข้อความ'
      
      if (error.response) {
        // Server responded with error status
        if (error.response.status === 401) {
          errorMessage = `เกิดข้อผิดพลาด: 401 - Unauthorized`
          console.error('401 Error Details:', {
            url: error.config?.url,
            headers: error.config?.headers,
            response: error.response.data
          })
          console.error('💡 ตรวจสอบว่า:')
          console.error('   1. ได้รีสตาร์ท dev server หลังจากเพิ่ม .env หรือยัง?')
          console.error('   2. API keys ใน .env ถูกต้องหรือไม่?')
          console.error('   3. ดู Request Headers ใน Console ด้านบน')
        } else if (error.response.status === 403) {
          errorMessage = `เกิดข้อผิดพลาด: 403 - Forbidden`
          console.error('403 Error Details:', {
            url: error.config?.url,
            headers: error.config?.headers,
            response: error.response.data
          })
          console.error('💡 403 Forbidden - ตรวจสอบว่า:')
          console.error('   1. API server ปฏิเสธการเข้าถึง - ตรวจสอบ authentication/authorization')
          console.error('   2. ตรวจสอบว่า VITE_INFORM_AGENT_USER และ VITE_INFORM_AGENT_PASS ถูกต้องหรือไม่')
          console.error('   3. ตรวจสอบว่า API key/token ยังใช้งานได้หรือไม่ (อาจหมดอายุ)')
          console.error('   4. ตรวจสอบว่า account มีสิทธิ์เข้าถึง API endpoint นี้หรือไม่')
          console.error('   5. ลองรีสตาร์ท dev server หลังจากแก้ไข .env')
          
          // แสดงข้อมูลเพิ่มเติมถ้ามี
          if (error.response.data) {
            console.error('Error response data:', error.response.data)
            if (typeof error.response.data === 'string') {
              errorMessage += `\n${error.response.data}`
            } else if (error.response.data.message) {
              errorMessage += `\n${error.response.data.message}`
            }
          }
        } else {
          errorMessage = `เกิดข้อผิดพลาด: ${error.response.status} - ${error.response.statusText}`
          if (error.response.data) {
            console.error('Error response data:', error.response.data)
            if (typeof error.response.data === 'string') {
              errorMessage += `\n${error.response.data}`
            } else if (error.response.data.message) {
              errorMessage += `\n${error.response.data.message}`
            }
          }
        }
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'การเชื่อมต่อหมดเวลา (60 วินาที) - API ใช้เวลาตอบสนองนานเกินไป กรุณาลองใหม่อีกครั้ง หรือตรวจสอบว่า API ทำงานปกติหรือไม่'
      } else {
        errorMessage = `เกิดข้อผิดพลาด: ${error.message}`
      }
      
      setStatus('error')
      setOutputMessage(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // API 2: Generate TTS audio (ใช้ outputMessage จาก chat response หรือ message ที่พิมพ์เข้าไป)
  const handleGenerateTTS = async () => {
    // ใช้ outputMessage ถ้ามี (response จาก chat) ไม่งั้นใช้ message (input)
    const textToConvert = outputMessage.trim() || message.trim()
    
    if (!textToConvert) {
      setStatus('ไม่มีข้อความที่จะแปลงเป็นเสียง')
      return
    }

    setAudioLoading(true)
    setStatus('')
    setAudioUrl(null)
    setAudioError('') // Clear previous error

    try {
      // Payload ตามที่ API ต้องการ - API return ไฟล์ WAV โดยตรง
      // ไม่ต้องส่ง language เพราะ backend จะตรวจจับภาษาจีนอัตโนมัติ
      const payload = {
        text: textToConvert, // ใช้ outputMessage ถ้ามี ไม่งั้นใช้ message
        speaker: '1',
        volume: 1,
        speed: 1,
        type_media: 'wav', // ใช้ wav ตามที่ API return
        language: 'th', // Backend จะ override เป็น 'zh' ถ้าตรวจจับภาษาจีนได้
        // ไม่ใส่ response_format เพื่อให้ API return ไฟล์โดยตรง
      }

      console.log('TTS API Payload:', payload)

      // ใช้ backend proxy เพื่อหลีกเลี่ยง CORS preflight issue
      // Backend proxy จะจัดการ API keys และเรียก TTS API จากฝั่ง server
      const baseApiUrl = getBaseApiUrl()
      const ttsUrl = `${baseApiUrl}/api/tts`
      const ttsHeaders = {
        'Content-Type': 'application/json',
      }
      
      console.log('🔊 Using backend proxy for TTS API:', ttsUrl)
      console.log('🔊 Headers:', ttsHeaders)
      
      // ใช้ responseType: 'blob' เพื่อรับ binary data (ไฟล์ WAV) โดยตรง
      const response = await axios.post(
        ttsUrl,
        payload,
        {
          headers: ttsHeaders,
          responseType: 'blob', // รับ binary data (ไฟล์ WAV) โดยตรง
          timeout: 60000, // 60 seconds timeout (TTS อาจใช้เวลานานในการสร้างเสียง)
        }
      )

      const contentType = response.headers['content-type'] || ''
      console.log('TTS API Response Type:', response.data?.constructor?.name)
      console.log('TTS API Content-Type:', contentType)
      console.log('TTS API Status:', response.status)

      // ตรวจสอบว่า response เป็น blob (binary data) หรือไม่
      if (response.data instanceof Blob) {
        // ตรวจสอบว่าเป็นไฟล์เสียงหรือไม่
        if (contentType.startsWith('audio/') || contentType.includes('wav') || contentType.includes('mp3')) {
          // API return ไฟล์เสียงโดยตรง (WAV/MP3 file)
          console.log('✅ Received audio file (Blob), Content-Type:', contentType)
          
          // Cleanup URL เก่าก่อน (ถ้ามี)
          if (audioUrl && audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioUrl)
          }
          
          // สร้าง object URL จาก blob เพื่อเล่นเสียง
          const audioBlobUrl = URL.createObjectURL(response.data)
          setAudioUrl(audioBlobUrl)
          setStatus('audio-success')
          setAudioError('') // Clear error เมื่อสำเร็จ
          console.log('✅ Audio URL created:', audioBlobUrl)
          return
        }
        
        // ถ้าเป็น blob แต่ไม่ใช่ audio อาจเป็น JSON ที่ถูก parse เป็น blob ผิด
        // พยายาม parse เป็น text แล้วค่อย parse เป็น JSON
        try {
          const textResponse = await response.data.text()
          console.log('TTS Response as text:', textResponse.substring(0, 200))
          
          // ลอง parse เป็น JSON
          try {
            const jsonData = JSON.parse(textResponse)
            console.log('TTS API Response (JSON):', jsonData)
            
            // รองรับ response format หลายแบบ
            if (jsonData) {
              // Format 1: { url: "..." }
              if (jsonData.url) {
                setAudioUrl(jsonData.url)
                setStatus('audio-success')
                setAudioError('') // Clear error เมื่อสำเร็จ
                return
              }
              // Format 2: { audio_url: "..." }
              if (jsonData.audio_url) {
                setAudioUrl(jsonData.audio_url)
                setStatus('audio-success')
                setAudioError('') // Clear error เมื่อสำเร็จ
                return
              }
              // Format 3: { data: { url: "..." } }
              if (jsonData.data && jsonData.data.url) {
                setAudioUrl(jsonData.data.url)
                setStatus('audio-success')
                setAudioError('') // Clear error เมื่อสำเร็จ
                return
              }
            }
          } catch (jsonError) {
            // ถ้า parse JSON ไม่ได้ อาจเป็น string URL โดยตรง
            if (textResponse && textResponse.trim().startsWith('http')) {
              setAudioUrl(textResponse.trim())
              setStatus('audio-success')
              setAudioError('') // Clear error เมื่อสำเร็จ
              return
            }
            console.error('Failed to parse as JSON:', jsonError)
          }
        } catch (textError) {
          console.error('Failed to read blob as text:', textError)
        }
      }

      // ถ้าไม่เจอ format ที่รู้จัก
      console.error('Unknown TTS response format:', response.data)
      setStatus('audio-error')
      setAudioError('ไม่สามารถสร้างเสียงได้ - รูปแบบข้อมูลไม่ถูกต้อง')
    } catch (error) {
      console.error('Error generating TTS:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        request: error.request,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
        }
      })
      
      let errorMessage = 'เกิดข้อผิดพลาดในการสร้างเสียง'
      
      if (error.response) {
        // Server responded with error status
        errorMessage = `เกิดข้อผิดพลาดในการสร้างเสียง: ${error.response.status} - ${error.response.statusText}`
        if (error.response.data) {
          console.error('TTS Error response data:', error.response.data)
          // ถ้ามี error message จาก API
          if (error.response.data.message) {
            errorMessage = `เกิดข้อผิดพลาด: ${error.response.data.message}`
          } else if (error.response.data.error) {
            errorMessage = `เกิดข้อผิดพลาด: ${error.response.data.error}`
          } else if (typeof error.response.data === 'string') {
            errorMessage = `เกิดข้อผิดพลาด: ${error.response.data}`
          }
        }
      } else if (error.request) {
        // Request was made but no response received - อาจเป็น network issue หรือ backend proxy ไม่ทำงาน
        console.error('No response received - อาจเป็น network problem หรือ backend proxy ไม่ทำงาน')
        console.error('Request details:', {
          url: error.config?.url,
          method: error.config?.method,
        })
        
        if (error.code === 'ERR_NETWORK') {
          errorMessage = 'ไม่สามารถเชื่อมต่อกับ backend proxy ได้ - กรุณาตรวจสอบว่า backend server ทำงานอยู่และ VITE_API_BASE_URL ถูกต้อง'
        } else {
          errorMessage = `ไม่สามารถเชื่อมต่อกับ backend proxy ได้ (${error.code || 'Network Error'}) - กรุณาตรวจสอบ Console สำหรับรายละเอียด`
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'การเชื่อมต่อ TTS API หมดเวลา (60 วินาที) - การสร้างเสียงใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง'
      } else {
        errorMessage = `เกิดข้อผิดพลาดในการสร้างเสียง: ${error.message || 'Unknown error'}`
      }
      
      setStatus('audio-error')
      setAudioError(errorMessage) // แสดง error แยกสำหรับฟังเสียง
    } finally {
      setAudioLoading(false)
    }
  }

  // Show dial pad when call button is clicked
  const handleMakeCall = () => {
    if (!message.trim()) {
      setStatus('ไม่มีข้อความที่จะโทรออก')
      return
    }
    setShowDialPad(true)
    setPhoneNumber('')
    setCallError('')
  }

  // Actually make the phone call with entered phone number
  const handleConfirmCall = async () => {
    if (!phoneNumber.trim()) {
      setCallError('กรุณากรอกหมายเลขโทรศัพท์')
      return
    }

    // ใช้ outputMessage (response จาก InformAgent) ถ้ามี ไม่งั้นใช้ message (input เดิม)
    const messageToCall = outputMessage.trim() || message.trim()
    
    if (!messageToCall) {
      setStatus('ไม่มีข้อความที่จะโทรออก')
      return
    }

    setCallLoading(true)
    setStatus('')
    setCallError('') // Clear previous error

    try {
      // ใช้ backend proxy เพื่อหลีกเลี่ยง CORS และ mixed content (HTTP/HTTPS) issues
      const baseApiUrl = getBaseApiUrl()
      const phoneCallUrl = `${baseApiUrl}/api/phone-call`
      
      // Parse phone number - remove non-numeric characters แต่เก็บเป็น string เพื่อรักษา leading zero
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, '')
      
      // ตรวจสอบว่า cleanPhoneNumber มีค่าหรือไม่
      if (!cleanPhoneNumber || cleanPhoneNumber.length === 0) {
        const defaultPhone = import.meta.env.VITE_DEFAULT_PHONE_NUMBER || '60004'
        const finalPhoneNumber = String(defaultPhone)
        
        const payload = {
          number: finalPhoneNumber,
          message: messageToCall, // ใช้ outputMessage ถ้ามี ไม่งั้นใช้ message
          phone_number: finalPhoneNumber,
          prompt_id: 3,
        }
        
        console.log('📞 Using backend proxy for Phone Call API:', phoneCallUrl)
        console.log('📞 Using outputMessage (from InformAgent):', outputMessage.trim())
        console.log('📞 Using message (original input):', message.trim())
        console.log('📞 Final message to call:', messageToCall)
        console.log('📞 Using phone number (string):', finalPhoneNumber)
        console.log('📞 Payload:', payload)
        
        const response = await axios.post(
          phoneCallUrl,
          payload,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 60000,
          }
        )
        
        console.log('📞 Phone Call API Response:', response.data)
        
        if (response.status === 200) {
          setStatus('call-success')
          setCallError('')
          setShowDialPad(false)
          setPhoneNumber('')
        } else {
          setStatus('call-error')
          setCallError(`เกิดข้อผิดพลาด: ${response.status} - ${response.statusText}`)
        }
        return
      }
      
      // ตรวจสอบว่าเบอร์ขึ้นต้นด้วย 0 หรือไม่
      // ถ้าขึ้นต้นด้วย 0 ต้องส่งเป็น string เพื่อรักษา leading zero
      const startsWithZero = cleanPhoneNumber.startsWith('0')
      const finalPhoneNumber = cleanPhoneNumber
      
      // สร้าง payload - ส่งเป็น string เสมอเพื่อรักษา leading zero
      // New structure: no person_name, prompt_id is number
      const payload = {
        number: finalPhoneNumber, // ส่งเป็น string เสมอ
        message: messageToCall, // ใช้ outputMessage ถ้ามี ไม่งั้นใช้ message
        phone_number: finalPhoneNumber, // ส่งเป็น string เสมอ
        prompt_id: 3,
      }
      
      // ตรวจสอบ payload ก่อนส่ง
      console.log('📞 Using backend proxy for Phone Call API:', phoneCallUrl)
      console.log('📞 Using outputMessage (from InformAgent):', outputMessage.trim())
      console.log('📞 Using message (original input):', message.trim())
      console.log('📞 Final message to call:', messageToCall)
      console.log('📞 Original phone number:', phoneNumber)
      console.log('📞 Clean phone number:', finalPhoneNumber)
      console.log('📞 Starts with 0?', startsWithZero)
      console.log('📞 Payload:', payload)
      
      // เรียกผ่าน backend proxy
      const response = await axios.post(
        phoneCallUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 seconds timeout
        }
      )

      console.log('📞 Phone Call API Response:', response.data)

      if (response.status === 200) {
        setStatus('call-success')
        setCallError('')
        setShowDialPad(false)
        setPhoneNumber('')
      } else {
        setStatus('call-error')
        setCallError(`เกิดข้อผิดพลาด: ${response.status} - ${response.statusText}`)
      }
    } catch (error) {
      console.error('Error making call:', error)
      
      let errorMessage = 'เกิดข้อผิดพลาดในการโทรออก'
      
      if (error.response) {
        errorMessage = `เกิดข้อผิดพลาดในการโทรออก: ${error.response.status} - ${error.response.statusText}`
        if (error.response.data) {
          console.error('Phone Call Error response data:', error.response.data)
          
          // Handle 502 Bad Gateway (backend cannot connect to Phone Call API)
          if (error.response.status === 502) {
            const errorDetail = error.response.data.detail || error.response.data
            console.error('502 Bad Gateway - Backend cannot connect to Phone Call API:', errorDetail)
            
            if (errorDetail.message) {
              // Extract useful information from error message
              let userFriendlyMsg = errorDetail.message
              
              // Check if it's a connection timeout
              if (errorDetail.message.includes('timeout') || errorDetail.message.includes('Connection timeout')) {
                userFriendlyMsg = 'Phone Call API server ไม่ตอบสนอง (timeout) - อาจเป็นปัญหา network/firewall ระหว่าง Azure กับ Phone Call API server'
              } else if (errorDetail.message.includes('Connection refused') || errorDetail.message.includes('cannot connect')) {
                userFriendlyMsg = 'ไม่สามารถเชื่อมต่อกับ Phone Call API server ได้ - กรุณาตรวจสอบว่า server ทำงานอยู่และ firewall อนุญาตให้ Azure เข้าถึงได้'
              } else if (errorDetail.message.includes('Name resolution failed') || errorDetail.message.includes('getaddrinfo failed')) {
                userFriendlyMsg = 'ไม่สามารถหา Phone Call API server ได้ - กรุณาตรวจสอบ URL และ DNS'
              }
              
              errorMessage = `ไม่สามารถเชื่อมต่อกับ Phone Call API ได้: ${userFriendlyMsg}`
            } else if (errorDetail.error) {
              errorMessage = `ไม่สามารถเชื่อมต่อกับ Phone Call API ได้: ${errorDetail.error}`
            } else {
              errorMessage = 'ไม่สามารถเชื่อมต่อกับ Phone Call API ได้ - กรุณาตรวจสอบว่า Phone Call API server ทำงานอยู่และ network/firewall อนุญาตให้ Azure เข้าถึงได้'
            }
          } else if (error.response.data.message) {
            errorMessage = `เกิดข้อผิดพลาด: ${error.response.data.message}`
          } else if (error.response.data.error) {
            errorMessage = `เกิดข้อผิดพลาด: ${error.response.data.error}`
          }
        }
      } else if (error.request) {
        // Request was made but no response received
        console.error('Phone Call - No response received')
        console.error('Request URL:', error.config?.url)
        console.error('Request method:', error.config?.method)
        console.error('Error code:', error.code)
        console.error('Error message:', error.message)
        
        // ตรวจสอบว่าเป็น network error หรือ CORS error
        if (error.code === 'ERR_NETWORK' || error.code === 'ERR_INTERNET_DISCONNECTED') {
          errorMessage = 'ไม่สามารถเชื่อมต่อกับ Phone Call API ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'
        } else if (error.code === 'ERR_CANCELED') {
          errorMessage = 'การเชื่อมต่อถูกยกเลิก - กรุณาลองใหม่อีกครั้ง'
        } else {
          errorMessage = `ไม่สามารถเชื่อมต่อกับ backend proxy ได้ (${error.code || 'Network Error'}) - กรุณาตรวจสอบ Console สำหรับรายละเอียด`
        }
      } else if (error.response && error.response.status === 405) {
        // Method Not Allowed - อาจเป็นปัญหา CORS preflight หรือ endpoint ไม่รองรับ method นี้
        errorMessage = 'Method Not Allowed (405) - กรุณาตรวจสอบว่า backend endpoint รองรับ POST method และ CORS ตั้งค่าถูกต้อง'
        console.error('405 Method Not Allowed - Check if endpoint supports POST and CORS is configured correctly')
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'การเชื่อมต่อ backend proxy หมดเวลา (60 วินาที) - กรุณาลองใหม่อีกครั้ง'
      } else {
        errorMessage = `เกิดข้อผิดพลาดในการโทรออก: ${error.message}`
      }
      
      setStatus('call-error')
      setCallError(errorMessage) // แสดง error แยกสำหรับโทรออก
    } finally {
      setCallLoading(false)
    }
  }

  // Handle dial pad number input
  const handleDialPadInput = (value) => {
    if (value === 'backspace') {
      setPhoneNumber(prev => prev.slice(0, -1))
    } else {
      setPhoneNumber(prev => prev + value)
    }
  }

  return (
    <div className="voicebot-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <img src="/Asset 52.png" alt="Asset 52" className="logo-asset" />
            <img src="/SCGJWD Logo.png" alt="SCGJWD Logo" className="logo-scgjwd" />
          </div>
          <p className="platform-text">AI Voicebot platform</p>
        </div>
        <div className="sidebar-tabs">
          <div 
            className={`sidebar-tab ${activeTab === 'call-interface' ? 'active' : ''}`}
            onClick={() => setActiveTab('call-interface')}
          >
            <span className="tab-label">Call interface</span>
          </div>
          <div 
            className={`sidebar-tab ${activeTab === 'monitoring' ? 'active' : ''}`}
            onClick={() => setActiveTab('monitoring')}
          >
            <span className="tab-label">Voicebot monitoring : Today's Call</span>
          </div>
          <div 
            className={`sidebar-tab ${activeTab === 'call-reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('call-reports')}
          >
            <span className="tab-label">Call Reports</span>
          </div>
        </div>
      </div>
      
      <div className="voicebot-content">
        {activeTab === 'call-reports' ? (
          <CallReports />
        ) : activeTab === 'monitoring' ? (
          <Dashboard />
        ) : activeTab === 'call-interface' ? (
          <>
            <div className="header">
              <h1 className="gradient-title">LCC Voicebot Interface</h1>
              <p className="gradient-subtitle">ระบบแจ้งเตือนอัจฉริยะ</p>
            </div>

        <div className="input-section">
          <div className="input-group">
            <label className="gradient-label">กรอกข้อความ</label>
            <textarea
              className="message-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="พิมพ์ข้อความที่ต้องการส่ง..."
              rows="6"
            />
            <button
              className="btn btn-primary"
              onClick={handleSendMessage}
              disabled={loading}
            >
              {loading ? (
                <span className="loading-spinner">⏳</span>
              ) : (
                <span>📤 ส่งข้อความ</span>
              )}
            </button>
          </div>
        </div>

        {/* แสดงปุ่มทั้ง 2 ปุ่มทันทีหลังจากส่งข้อความสำเร็จ */}
        {(status === 'success' || outputMessage) && (
          <div className="output-section">
            {outputMessage && (
              <div className="output-card">
                <div className="output-header">
                  <h3 className="gradient-text">ข้อความตอบกลับ</h3>
                </div>
                <div className="output-message">
                  <p>{outputMessage}</p>
                </div>
              </div>
            )}

            <div className="action-buttons">
              <div className="action-button-group">
                <button
                  className="btn btn-secondary btn-tts"
                  onClick={handleGenerateTTS}
                  disabled={audioLoading || (!outputMessage.trim() && !message.trim())}
                >
                  {audioLoading ? (
                    <span className="loading-spinner">⏳</span>
                  ) : (
                    <span>🔊 ฟังเสียง</span>
                  )}
                </button>
                {audioError && (
                  <div className="error-message audio-error-message">
                    ❌ {audioError}
                  </div>
                )}
              </div>

              <div className="action-button-group">
                <button
                  className="btn btn-secondary btn-call"
                  onClick={handleMakeCall}
                  disabled={callLoading || !outputMessage.trim()}
                >
                  {callLoading ? (
                    <span className="loading-spinner">⏳</span>
                  ) : (
                    <span>📞 โทรออก</span>
                  )}
                </button>
                {callError && (
                  <div className="error-message call-error-message">
                    ❌ {callError}
                  </div>
                )}
              </div>
            </div>

            {audioUrl && (
              <div className="audio-player-section">
                <div className="audio-card">
                  <h4 className="gradient-text">เสียงที่สร้างแล้ว</h4>
                  <audio controls className="audio-player">
                    <source src={audioUrl} type="audio/wav" />
                    <source src={audioUrl} type="audio/mpeg" />
                    <source src={audioUrl} type="audio/mp3" />
                    เบราว์เซอร์ของคุณไม่รองรับการเล่นเสียง
                  </audio>
                </div>
              </div>
            )}
          </div>
        )}

        {status && !status.includes('error') && (
          <div className={`status-message ${status}`}>
            {status === 'success' && '✅ ส่งข้อความสำเร็จ'}
            {status === 'audio-success' && '✅ สร้างเสียงสำเร็จ'}
            {status === 'call-success' && '✅ เริ่มโทรออกสำเร็จ'}
            {!status.includes('success') && !status.includes('error') && status}
          </div>
        )}
          </>
        ) : null}
      </div>

      {/* Dial Pad Modal */}
      {showDialPad && (
        <div className="dial-pad-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowDialPad(false)
            setPhoneNumber('')
          }
        }}>
          <div className="dial-pad-container" onClick={(e) => e.stopPropagation()}>
            <div className="dial-pad-header">
              <h3 className="gradient-text">กรอกหมายเลขโทรศัพท์</h3>
              <button 
                className="dial-pad-close"
                onClick={() => {
                  setShowDialPad(false)
                  setPhoneNumber('')
                }}
              >
                ✕
              </button>
            </div>
            
            <div className="dial-pad-display">
              <div className="phone-number-display">
                {phoneNumber || <span className="placeholder">กรุณากรอกเบอร์โทรศัพท์</span>}
              </div>
              {phoneNumber && (
                <button 
                  className="dial-pad-backspace"
                  onClick={() => handleDialPadInput('backspace')}
                >
                  ⌫
                </button>
              )}
            </div>

            <div className="dial-pad-grid">
              <button className="dial-pad-key" onClick={() => handleDialPadInput('1')}>
                <span className="dial-number">1</span>
              </button>
              <button className="dial-pad-key" onClick={() => handleDialPadInput('2')}>
                <span className="dial-number">2</span>
                <span className="dial-letters">ABC</span>
              </button>
              <button className="dial-pad-key" onClick={() => handleDialPadInput('3')}>
                <span className="dial-number">3</span>
                <span className="dial-letters">DEF</span>
              </button>
              <button className="dial-pad-key" onClick={() => handleDialPadInput('4')}>
                <span className="dial-number">4</span>
                <span className="dial-letters">GHI</span>
              </button>
              <button className="dial-pad-key" onClick={() => handleDialPadInput('5')}>
                <span className="dial-number">5</span>
                <span className="dial-letters">JKL</span>
              </button>
              <button className="dial-pad-key" onClick={() => handleDialPadInput('6')}>
                <span className="dial-number">6</span>
                <span className="dial-letters">MNO</span>
              </button>
              <button className="dial-pad-key" onClick={() => handleDialPadInput('7')}>
                <span className="dial-number">7</span>
                <span className="dial-letters">PQRS</span>
              </button>
              <button className="dial-pad-key" onClick={() => handleDialPadInput('8')}>
                <span className="dial-number">8</span>
                <span className="dial-letters">TUV</span>
              </button>
              <button className="dial-pad-key" onClick={() => handleDialPadInput('9')}>
                <span className="dial-number">9</span>
                <span className="dial-letters">WXYZ</span>
              </button>
              <button className="dial-pad-key" onClick={() => handleDialPadInput('*')}>
                <span className="dial-number">*</span>
              </button>
              <button className="dial-pad-key" onClick={() => handleDialPadInput('0')}>
                <span className="dial-number">0</span>
                <span className="dial-letters">+</span>
              </button>
              <button className="dial-pad-key" onClick={() => handleDialPadInput('#')}>
                <span className="dial-number">#</span>
              </button>
            </div>

            <div className="dial-pad-actions">
              <button
                className="btn btn-primary dial-call-btn"
                onClick={handleConfirmCall}
                disabled={callLoading || !phoneNumber.trim()}
              >
                {callLoading ? (
                  <span className="loading-spinner">⏳</span>
                ) : (
                  <span>📞 โทรออก</span>
                )}
              </button>
              {callError && (
                <div className="error-message call-error-message">
                  ❌ {callError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VoicebotInterface

