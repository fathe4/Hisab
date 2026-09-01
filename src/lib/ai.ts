import type { Category } from '../types'

/** A transaction the AI extracted from a chat message, pre-validation. */
export interface AiTransaction {
  type: 'income' | 'expense'
  note: string
  amount: number
  date: string
  category_id: string | null
  suggested_category: string | null
}

export interface AiReply {
  reply: string
  transaction: AiTransaction | null
}

const ENDPOINT = '/.netlify/functions/ai-chat'

/**
 * Sends one chat message to the Netlify function and returns the parsed
 * reply (and transaction, when the message described one). Throws Error
 * with a friendly message on any failure.
 */
export async function askAi(
  message: string,
  categories: Pick<Category, 'id' | 'name' | 'icon' | 'type'>[],
): Promise<AiReply> {
  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        today: todayLocal(),
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          type: c.type,
        })),
      }),
    })
  } catch {
    throw new Error("Couldn't reach the AI service — check your connection.")
  }

  let data: { reply?: string; transaction?: AiTransaction | null; error?: string }
  try {
    data = await res.json()
  } catch {
    throw new Error('The AI service returned an unexpected response.')
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'AI chat needs Netlify functions — run `npx netlify-cli dev` locally instead of plain `vite`.',
      )
    }
    throw new Error(data.error ?? 'The AI service failed. Try again in a moment.')
  }

  return {
    reply: data.reply ?? '',
    transaction: data.transaction ?? null,
  }
}

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const TRANSCRIBE_ENDPOINT = '/.netlify/functions/ai-transcribe'

/**
 * Sends a voice recording (MediaRecorder blob) to the Netlify function and
 * returns the transcribed text. Throws Error with a friendly message.
 */
export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData()
  form.append('file', blob, blob.type.includes('mp4') ? 'speech.mp4' : 'speech.webm')

  let res: Response
  try {
    res = await fetch(TRANSCRIBE_ENDPOINT, { method: 'POST', body: form })
  } catch {
    throw new Error("Couldn't reach the transcription service — check your connection.")
  }

  let data: { text?: string; error?: string }
  try {
    data = await res.json()
  } catch {
    throw new Error('The transcription service returned an unexpected response.')
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'Speech-to-text needs Netlify functions — run `npx netlify-cli dev` locally instead of plain `vite`.',
      )
    }
    throw new Error(data.error ?? 'Could not transcribe the audio. Try again.')
  }

  const text = (data.text ?? '').trim()
  if (!text) throw new Error('No speech detected in the recording — try again.')
  return text
}
