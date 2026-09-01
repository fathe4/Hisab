import { useEffect, useRef, useState } from 'react'
import { XIcon, SparklesIcon, SendIcon, BoltIcon } from './icons'
import Spinner from './Spinner'
import { useCategories } from '../hooks/useCategories'
import { useSaveTransaction } from '../hooks/useTransactions'
import { askAi, type AiTransaction } from '../lib/ai'
import { formatDay } from '../lib/dates'
import { formatTaka } from '../lib/format'

/**
 * Floating AI assistant: describe a transaction in plain language
 * ("burger 350", "salary 45000"), the AI parses it into a confirm card
 * (name, amount, best category, date) and one tap saves the real
 * transaction via the normal client → Supabase path. With ⚡ Auto-save
 * on, the confirmation step is skipped entirely.
 */

type CardStatus = 'pending' | 'saving' | 'saved' | 'cancelled' | 'error'

interface ConfirmCard {
  tx: AiTransaction
  categoryId: string
  status: CardStatus
  error?: string
}

interface ChatMessage {
  role: 'user' | 'bot'
  text: string
  card?: ConfirmCard
}

const EXAMPLES = ['Burger 350', 'Salary 45000', 'Rickshaw 20 yesterday']
const AUTOSAVE_KEY = 'hisab-ai-autosave'

export default function AiChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [autoSave, setAutoSave] = useState(() => localStorage.getItem(AUTOSAVE_KEY) === '1')

  const { data: categories = [] } = useCategories()
  const save = useSaveTransaction()
  const scrollRef = useRef<HTMLDivElement>(null)

  const toggleAutoSave = () => {
    setAutoSave((on) => {
      localStorage.setItem(AUTOSAVE_KEY, on ? '0' : '1')
      return !on
    })
  }

  useEffect(() => {
    // keep the latest message visible
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, thinking, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  /** Auto-save category: the AI's pick, else the "Other <type>" fallback. */
  const resolveAutoCategory = (tx: AiTransaction): string | null => {
    if (tx.category_id) return tx.category_id
    const other = categories.find((c) => c.type === tx.type && /^other/i.test(c.name))
    return other?.id ?? categories.find((c) => c.type === tx.type)?.id ?? null
  }

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim()
    if (!text || thinking) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setThinking(true)
    try {
      const res = await askAi(text, categories)
      const tx = res.transaction

      // ⚡ Auto-save: skip the confirm card and write straight away
      if (tx && autoSave) {
        const categoryId = resolveAutoCategory(tx)
        if (categoryId) {
          let card: ConfirmCard
          try {
            await save.mutateAsync({
              category_id: categoryId,
              type: tx.type,
              amount: tx.amount,
              note: tx.note,
              transaction_date: tx.date,
            })
            card = { tx, categoryId, status: 'saved' }
          } catch (err) {
            card = {
              tx,
              categoryId,
              status: 'error',
              error: err instanceof Error ? err.message : 'Could not save — confirm manually.',
            }
          }
          setMessages((m) => [...m, { role: 'bot', text: res.reply, card }])
          return
        }
        // no category of this type exists at all → fall through to the card
      }

      setMessages((m) => [
        ...m,
        {
          role: 'bot',
          text: res.reply || (tx ? 'Here is what I understood:' : "I didn't catch that."),
          card: tx
            ? { tx, categoryId: tx.category_id ?? '', status: 'pending' }
            : undefined,
        },
      ])
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: 'bot', text: err instanceof Error ? err.message : 'Something went wrong.' },
      ])
    } finally {
      setThinking(false)
    }
  }

  const patchCard = (index: number, patch: Partial<ConfirmCard>) => {
    setMessages((m) =>
      m.map((msg, i) => (i === index ? { ...msg, card: msg.card ? { ...msg.card, ...patch } : msg.card } : msg)),
    )
  }

  return (
    <>
      {/* Floating button — sits high enough on desktop to clear the
          Netlify badge that sites show in the bottom-right corner */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="AI assistant"
          className="fixed bottom-24 right-4 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 active:scale-95 lg:bottom-20 lg:right-6"
        >
          <SparklesIcon width={22} height={22} />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-x-3 bottom-24 z-40 flex h-[min(30rem,68vh)] flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 lg:inset-x-auto lg:right-6 lg:bottom-20 lg:w-[24rem]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <p className="flex items-center gap-2 text-sm font-bold">
              <SparklesIcon width={16} height={16} className="text-indigo-500" />
              Assistant
            </p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <XIcon width={16} height={16} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !thinking && (
              <div className="space-y-3 pt-4 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-500/15">
                  <SparklesIcon />
                </span>
                <p className="text-sm font-semibold">Tell me what you spent</p>
                <p className="mx-auto max-w-[16rem] text-xs text-gray-400 dark:text-gray-500">
                  Say something like “burger 350” or “salary 45000” — I'll pick the category and you just confirm.
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => send(ex)}
                      className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-500 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex flex-col items-start gap-2'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-3.5 py-2 text-sm text-white'
                      : 'max-w-[92%] rounded-2xl rounded-bl-md bg-gray-100 px-3.5 py-2 text-sm dark:bg-gray-800'
                  }
                >
                  {m.text}
                </div>
                {m.card && (
                  <ConfirmCardView
                    card={m.card}
                    categories={categories}
                    onPatch={(patch) => patchCard(i, patch)}
                  />
                )}
              </div>
            ))}

            {thinking && (
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3 dark:bg-gray-800">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            className="flex items-center gap-2 border-t border-gray-100 p-3 dark:border-gray-800"
          >
            <button
              type="button"
              onClick={toggleAutoSave}
              aria-pressed={autoSave}
              title={
                autoSave
                  ? 'Auto-save ON — transactions are saved without confirmation'
                  : 'Auto-save OFF — every transaction asks before saving'
              }
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                autoSave
                  ? 'bg-amber-100 text-amber-600 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/30'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300'
              }`}
            >
              <BoltIcon width={18} height={18} />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. burger 350"
              maxLength={500}
              autoFocus
              className="field flex-1"
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-40"
            >
              <SendIcon width={18} height={18} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}

// ================= Confirm card =================

function ConfirmCardView({
  card,
  categories,
  onPatch,
}: {
  card: ConfirmCard
  categories: { id: string; name: string; icon: string | null; type: string; color: string }[]
  onPatch: (patch: Partial<ConfirmCard>) => void
}) {
  const save = useSaveTransaction()
  const { tx } = card
  const chosen = categories.find((c) => c.id === card.categoryId)
  const options = categories.filter((c) => c.type === tx.type)

  if (card.status === 'saved') {
    return (
      <div className="flex w-full items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <span className="text-emerald-600 dark:text-emerald-400">✓ Saved</span>
        <span className="truncate text-gray-500 dark:text-gray-400">
          {tx.note} · {formatTaka(tx.amount)} · {chosen?.name}
        </span>
      </div>
    )
  }

  if (card.status === 'cancelled') {
    return (
      <div className="w-full rounded-2xl border border-gray-100 px-3.5 py-2.5 text-sm text-gray-400 line-through dark:border-gray-800 dark:text-gray-500">
        {tx.note} · {formatTaka(tx.amount)} — cancelled
      </div>
    )
  }

  const submit = async () => {
    if (!card.categoryId) return
    onPatch({ status: 'saving', error: undefined })
    try {
      await save.mutateAsync({
        category_id: card.categoryId,
        type: tx.type,
        amount: tx.amount,
        note: tx.note,
        transaction_date: tx.date,
      })
      onPatch({ status: 'saved' })
    } catch (err) {
      onPatch({
        status: 'error',
        error: err instanceof Error ? err.message : 'Could not save. Try again.',
      })
    }
  }

  return (
    <div className="w-full rounded-2xl border border-gray-200 p-3 dark:border-gray-700">
      {/* Parsed summary */}
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
          style={{ backgroundColor: `${chosen?.color ?? '#6366f1'}1A` }}
        >
          {chosen?.icon ?? '🧾'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {tx.note}
            <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${
              tx.type === 'income'
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
            }`}>
              {tx.type}
            </span>
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {formatTaka(tx.amount)} · {formatDay(tx.date)}
          </p>
        </div>
      </div>

      {/* Category picker */}
      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {tx.category_id ? 'Category (tap to change)' : tx.suggested_category ? `No match — create “${tx.suggested_category}” later, or pick:` : 'Pick a category'}
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {options.map((c) => {
            const selected = c.id === card.categoryId
            return (
              <button
                key={c.id}
                type="button"
                disabled={card.status === 'saving'}
                onClick={() => onPatch({ categoryId: selected ? '' : c.id })}
                className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-1.5 text-center transition ${
                  selected
                    ? 'border-transparent text-white shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                } ${card.status === 'saving' ? 'opacity-60' : ''}`}
                style={selected ? { backgroundColor: c.color } : undefined}
              >
                <span className="text-sm leading-none">{c.icon ?? '🏷️'}</span>
                <span className="w-full truncate text-[9px] font-medium leading-tight">{c.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {card.status === 'error' && card.error && (
        <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
          {card.error}
        </p>
      )}

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onPatch({ status: 'cancelled' })}
          disabled={card.status === 'saving'}
          className="flex-1 rounded-xl border border-gray-200 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!card.categoryId || card.status === 'saving'}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {card.status === 'saving' ? (
            <>
              <Spinner className="h-3.5 w-3.5 text-white" /> Saving…
            </>
          ) : (
            `Save · ${formatTaka(tx.amount)}`
          )}
        </button>
      </div>
    </div>
  )
}
