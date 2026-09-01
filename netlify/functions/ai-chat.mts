// AI chat endpoint — parses a free-text message into a transaction using Groq.
// The API key lives only in the server environment (Netlify site settings);
// it must never be exposed to the browser bundle (no VITE_ prefix).
//
// Env vars:
//   GROQ_API_KEY   required — from https://console.groq.com/keys
//   GROQ_MODEL     optional — default "llama-3.3-70b-versatile"
//   GROQ_BASE_URL  optional — OpenAI-compatible base URL, default Groq's

interface CategoryBrief {
  id: string
  name: string
  icon: string | null
  type: 'income' | 'expense'
}

interface AiTransaction {
  type: 'income' | 'expense'
  note: string
  amount: number
  date: string // YYYY-MM-DD
  category_id: string | null
  suggested_category: string | null
}

const DEFAULT_MODEL = 'llama-3.3-70b-versatile'
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1'
const MAX_MESSAGE_CHARS = 500

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return json(
      { error: 'AI is not configured — add GROQ_API_KEY in Netlify → Site settings → Environment variables.' },
      503,
    )
  }

  let body: { message?: unknown; categories?: unknown; today?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return json({ error: 'Empty message.' }, 400)
  if (message.length > MAX_MESSAGE_CHARS) {
    return json({ error: 'Message too long.' }, 400)
  }

  const categories = (Array.isArray(body.categories) ? body.categories : [])
    .filter(
      (c): c is CategoryBrief =>
        !!c &&
        typeof c === 'object' &&
        typeof (c as CategoryBrief).id === 'string' &&
        typeof (c as CategoryBrief).name === 'string',
    )
    .slice(0, 60)
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon ?? null, type: c.type }))

  const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10)

  const system = [
    'You are the assistant of a personal finance app. Currency is Bangladeshi Taka (৳).',
    `Today is ${today}.`,
    'The user describes a transaction in casual language (English or Banglish).',
    'Extract ONE transaction and reply ONLY with a JSON object:',
    '{"reply": string, "transaction": null | {"type": "income"|"expense", "note": string, "amount": number, "date": "YYYY-MM-DD", "category_id": string|null, "suggested_category": string|null}}',
    'Rules:',
    '- amount is a plain number (no currency symbol). If no amount is stated, set transaction to null and ask for it in reply.',
    '- type: income only for money received (salary, freelance payment, gift money received); otherwise expense.',
    '- date: resolve relative words like "yesterday"/"kal" using today; omit → today.',
    '- category_id: choose the single best match from the user\'s categories list below, else null.',
    '- suggested_category: when category_id is null, a short name for a category the user could create, else null.',
    '- note: 1–4 words describing it, e.g. "Burger", "Rickshaw ride".',
    '- reply: one short friendly sentence confirming what you understood (it will be shown above a confirm card).',
    '- If the message is not about recording a transaction, reply helpfully in one or two sentences and set transaction to null.',
    `User's categories: ${JSON.stringify(categories)}`,
  ].join('\n')

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)

    const groqRes = await fetch(
      `${process.env.GROQ_BASE_URL ?? DEFAULT_BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: process.env.GROQ_MODEL ?? DEFAULT_MODEL,
          temperature: 0.2,
          max_tokens: 400,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: message },
          ],
        }),
      },
    )
    clearTimeout(timer)

    if (!groqRes.ok) {
      const detail = await groqRes.text().catch(() => '')
      console.error(`Groq API error ${groqRes.status}: ${detail.slice(0, 300)}`)
      return json({ error: 'The AI service failed. Try again in a moment.' }, 502)
    }

    const groqBody = (await groqRes.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = groqBody.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(content) as { reply?: unknown; transaction?: unknown }

    return json({
      reply: typeof parsed.reply === 'string' ? parsed.reply : '',
      transaction: sanitizeTransaction(parsed.transaction, categories),
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return json({ error: 'The AI took too long to answer. Try again.' }, 504)
    }
    console.error('ai-chat function error:', err)
    return json({ error: 'Something went wrong talking to the AI.' }, 500)
  }
}

/** Keeps only well-formed values so a bad model reply can never reach the DB layer. */
function sanitizeTransaction(raw: unknown, categories: CategoryBrief[]): AiTransaction | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>

  const amount = Number(t.amount)
  const type = t.type === 'income' ? 'income' : 'expense'
  const note = typeof t.note === 'string' ? t.note.trim().slice(0, 40) : ''
  const date = typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : null
  const categoryId = typeof t.category_id === 'string' ? t.category_id : null
  const suggested =
    typeof t.suggested_category === 'string' ? t.suggested_category.trim().slice(0, 40) : null

  if (!Number.isFinite(amount) || amount <= 0 || !note || !date) return null
  if (categoryId && !categories.some((c) => c.id === categoryId && c.type === type)) return null

  return {
    type,
    note,
    amount: Math.round(amount * 100) / 100,
    date,
    category_id: categoryId,
    suggested_category: categoryId ? null : suggested || null,
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
