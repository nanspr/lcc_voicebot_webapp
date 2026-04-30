import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // โหลด environment variables
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    server: {
      proxy: {
        // Proxy สำหรับ TTS API เพื่อแก้ปัญหา CORS
        '/api/tts': {
          target: 'https://voice-tts.botnoi.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/tts/, '/scgjwd/api/doctts'),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              // เพิ่ม headers สำหรับ authentication จาก environment variables
              const xApiKey = env.VITE_X_API_KEY
              const apiKey = env.VITE_API_KEY
              
              if (xApiKey) {
                proxyReq.setHeader('x-api-key', xApiKey)
              }
              if (apiKey) {
                proxyReq.setHeader('key', apiKey)
              }
              
              console.log('🔧 Proxy Request Headers:', {
                'x-api-key': xApiKey ? '***' + xApiKey.slice(-4) : 'not set',
                'key': apiKey ? '***' + apiKey.slice(-4) : 'not set',
              })
            })
          },
        },
      },
    },
  }
})

