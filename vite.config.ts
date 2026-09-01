import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // AI_PROXY=1 proxies the Netlify function endpoint to scripts/ai-dev-server.mjs
  // so the AI chat can be developed without Netlify or a real Groq key.
  server: process.env.AI_PROXY
    ? { proxy: { '/.netlify/functions': 'http://localhost:8788' } }
    : undefined,
  build: {
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [{ name: 'recharts', test: /recharts/ }],
        },
      },
    },
  },
})
