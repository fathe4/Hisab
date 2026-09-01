// Speech-to-text endpoint — forwards a voice recording to Groq's Whisper
// (whisper-large-v3-turbo) so the chat can accept spoken transactions.
// The API key lives only in the server environment, same as ai-chat.
//
// Env vars (shared with ai-chat):
//   GROQ_API_KEY     required
//   GROQ_STT_MODEL   optional — default "whisper-large-v3-turbo"
//   GROQ_BASE_URL    optional — OpenAI-compatible base URL

const DEFAULT_STT_MODEL = 'whisper-large-v3-turbo'
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1'
const MAX_AUDIO_BYTES = 5_000_000 // Netlify request limit is 6MB; stay under

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

  let file: File | null = null
  try {
    const form = await req.formData()
    const value = form.get('file')
    if (value instanceof File) file = value
  } catch {
    // fall through to the error below
  }
  if (!file) return json({ error: 'No audio received.' }, 400)
  if (file.size === 0) return json({ error: 'The recording was empty.' }, 400)
  if (file.size > MAX_AUDIO_BYTES) {
    return json({ error: 'Recording too long — keep it under a minute.' }, 413)
  }

  const upstream = new FormData()
  upstream.append('file', file, file.name || 'speech.webm')
  upstream.append('model', process.env.GROQ_STT_MODEL ?? DEFAULT_STT_MODEL)
  upstream.append('response_format', 'json')

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8_000)

    const groqRes = await fetch(
      `${process.env.GROQ_BASE_URL ?? DEFAULT_BASE_URL}/audio/transcriptions`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: upstream,
        signal: controller.signal,
      },
    )
    clearTimeout(timer)

    if (!groqRes.ok) {
      const detail = await groqRes.text().catch(() => '')
      console.error(`Groq STT error ${groqRes.status}: ${detail.slice(0, 300)}`)
      return json({ error: 'Could not transcribe the audio. Try again.' }, 502)
    }

    const data = (await groqRes.json()) as { text?: string }
    return json({ text: (data.text ?? '').trim() })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return json({ error: 'Transcription took too long. Try a shorter recording.' }, 504)
    }
    console.error('ai-transcribe function error:', err)
    return json({ error: 'Something went wrong transcribing the audio.' }, 500)
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
