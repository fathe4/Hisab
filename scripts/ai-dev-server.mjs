// Local AI dev rig — run with:  node scripts/ai-dev-server.mjs
//
// Serves TWO things on http://localhost:8788 so the AI chat can be developed
// and tested without a real Groq key or Netlify:
//   POST /ai-chat              → the real netlify/functions/ai-chat.mts handler
//   POST /v1/chat/completions  → a deterministic mock of the Groq API
//
// Start Vite with AI_PROXY=1 to proxy /.netlify/functions/* here (see vite.config.ts).

import http from 'node:http'
import aiChatHandler from '../netlify/functions/ai-chat.mts'
import aiTranscribeHandler from '../netlify/functions/ai-transcribe.mts'

const PORT = 8788

/** Deterministic stand-in for the LLM: parses "burger 350" style messages. */
function mockParse(body) {
  const messages = body.messages ?? []
  const userMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const system = messages.find((m) => m.role === 'system')?.content ?? ''

  const categoriesMatch = system.match(/User's categories: (.*)$/s)
  let categories = []
  try {
    categories = JSON.parse(categoriesMatch?.[1] ?? '[]')
  } catch {}

  const today = system.match(/Today is (\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10)

  const words = userMsg.toLowerCase()
  const amount = Number((userMsg.match(/(\d+(?:\.\d+)?)/) ?? [])[1])
  if (!amount) {
    return {
      reply: "I didn't catch an amount — try something like “burger 350”.",
      transaction: null,
    }
  }

  const income = /salary|income|received|payment received|freelance/.test(words)
  const KEYWORDS = {
    burger: 'Food', lunch: 'Food', dinner: 'Food', food: 'Food', cha: 'Food',
    bus: 'Transport', rickshaw: 'Transport', uber: 'Transport', taxi: 'Transport', cigar: 'Transport',
    salary: 'Salary', freelance: 'Freelance',
    shoes: 'Shopping', cloth: 'Shopping', shopping: 'Shopping',
    rent: 'Bills & Rent', bill: 'Bills & Rent', internet: 'Bills & Rent', wifi: 'Bills & Rent', electricity: 'Bills & Rent',
    medicine: 'Health', doctor: 'Health',
    movie: 'Entertainment', netflix: 'Entertainment', game: 'Entertainment',
    book: 'Education', course: 'Education', tuition: 'Education',
  }
  let category = categories.find((c) => words.includes(c.name.toLowerCase())) ?? null
  if (!category) {
    for (const [kw, name] of Object.entries(KEYWORDS)) {
      if (words.includes(kw)) {
        category = categories.find((c) => c.name === name) ?? null
        break
      }
    }
  }

  let date = today
  if (/yesterday|kal\b/.test(words)) {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    date = d.toISOString().slice(0, 10)
  }

  const note = (userMsg.match(/[a-zA-Z][a-zA-Z ]*/) ?? ['Expense'])[0].trim().slice(0, 30) || 'Expense'
  return {
    reply: `Got it — ${note}, ৳${amount}${date !== today ? ` (${date})` : ''}. Check the card below:`,
    transaction: {
      type: income ? 'income' : 'expense',
      note: note.replace(/\b\w/g, (ch) => ch.toUpperCase()),
      amount,
      date,
      category_id: category?.id ?? null,
      suggested_category: category ? null : note.replace(/\b\w/g, (ch) => ch.toUpperCase()),
    },
  }
}

const server = http.createServer(async (req, res) => {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const rawBody = Buffer.concat(chunks)

  try {
    if (req.url?.endsWith('/chat/completions')) {
      // ---- mock Groq ----
      const body = JSON.parse(rawBody.toString() || '{}')
      const parsed = mockParse(body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(parsed) } }],
        }),
      )
      return
    }

    if (req.url?.endsWith('/audio/transcriptions')) {
      // ---- mock Groq Whisper ----
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ text: 'rickshaw 20 yesterday' }))
      return
    }

    if (req.url?.endsWith('/ai-chat') || req.url?.endsWith('/ai-transcribe')) {
      // ---- real function handlers ----
      const handler = req.url.endsWith('/ai-transcribe') ? aiTranscribeHandler : aiChatHandler
      const request = new Request('http://localhost' + req.url, {
        method: req.method,
        headers: req.headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : rawBody,
      })
      const response = await handler(request)
      const text = await response.text()
      res.writeHead(response.status, Object.fromEntries(response.headers))
      res.end(text)
      return
    }

    res.writeHead(404).end('not found')
  } catch (err) {
    console.error('dev server error:', err)
    res.writeHead(500).end('dev server error')
  }
})

server.listen(PORT, () => {
  console.log(`AI dev rig → function: http://localhost:${PORT}/ai-chat · mock groq: /v1/chat/completions`)
})
