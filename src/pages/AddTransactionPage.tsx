import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Spinner from '../components/Spinner'
import { CheckIcon, ChevronLeftIcon } from '../components/icons'
import { useCategories } from '../hooks/useCategories'
import { useSaveTransaction } from '../hooks/useTransactions'
import { todayISO } from '../lib/dates'
import { formatTaka } from '../lib/format'
import type { TransactionType } from '../types'

/**
 * Dedicated "new transaction" page — reachable in one click from the
 * sidebar, the mobile bottom bar, and the transactions page.
 */
export default function AddTransactionPage() {
  const navigate = useNavigate()
  const { data: categories = [] } = useCategories()
  const save = useSaveTransaction()

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [savedHint, setSavedHint] = useState(false)

  const options = categories.filter((c) => c.type === type)

  const switchType = (next: TransactionType) => {
    setType(next)
    // Selected category doesn't belong to the new type — clear it
    if (categoryId && !categories.some((c) => c.id === categoryId && c.type === next)) {
      setCategoryId('')
    }
  }

  const validate = () => {
    const value = Number(amount)
    if (!value || value <= 0) {
      setError('Please enter an amount greater than zero.')
      return false
    }
    if (!categoryId) {
      setError('Please choose a category.')
      return false
    }
    return true
  }

  /** Save and go see the result in the transactions list. */
  const saveAndFinish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setError(null)
    try {
      await save.mutateAsync({
        category_id: categoryId,
        type,
        amount: Number(amount),
        note: note.trim() || null,
        transaction_date: date,
      })
      // Land on the month the transaction was dated in, so it's always visible
      navigate('/transactions', { state: { month: date.slice(0, 7) } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  /** Save without leaving the page — handy for recording several in a row. */
  const saveAndAddAnother = async () => {
    if (!validate()) return
    setError(null)
    try {
      await save.mutateAsync({
        category_id: categoryId,
        type,
        amount: Number(amount),
        note: note.trim() || null,
        transaction_date: date,
      })
      setAmount('')
      setNote('')
      setSavedHint(true)
      window.setTimeout(() => setSavedHint(false), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  const busy = save.isPending

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link
          to="/transactions"
          className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          aria-label="Back to transactions"
        >
          <ChevronLeftIcon />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">New transaction</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Record it in a few seconds
          </p>
        </div>
      </div>

      <form onSubmit={saveAndFinish} className="card space-y-5 p-5 sm:p-6">
        {/* Type toggle */}
        <div className="segment">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchType(t)}
              className={`rounded-lg py-2 text-sm font-semibold capitalize transition ${
                type === t
                  ? t === 'expense'
                    ? 'bg-white text-rose-600 shadow-sm dark:bg-gray-700 dark:text-rose-400'
                    : 'bg-white text-emerald-600 shadow-sm dark:bg-gray-700 dark:text-emerald-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Amount (৳)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-gray-400 dark:text-gray-500">
              ৳
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="field w-full py-3.5 pl-10 text-2xl font-bold"
              autoFocus
            />
          </div>
          {amount && Number(amount) > 0 && (
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              {formatTaka(Number(amount))}
            </p>
          )}
        </div>

        {/* Category chips */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Category
          </label>
          {options.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No {type} categories yet —{' '}
              <Link to="/categories" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                create one
              </Link>
              .
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {options.map((c) => {
                const selected = categoryId === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(selected ? '' : c.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition ${
                      selected
                        ? 'border-transparent text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-700/60'
                    }`}
                    style={selected ? { backgroundColor: c.color } : undefined}
                  >
                    <span className="text-xl leading-none">{c.icon ?? '🏷️'}</span>
                    <span className="w-full truncate text-xs font-medium">{c.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Date + Note */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Note <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
            </label>
            <input
              type="text"
              maxLength={200}
              placeholder="e.g. lunch with friends"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="field w-full"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={saveAndAddAnother}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {savedHint ? (
              <>
                <CheckIcon width={16} height={16} className="text-emerald-500" /> Added
              </>
            ) : (
              'Save & add another'
            )}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="h-4 w-4 text-white" /> Saving…
              </span>
            ) : (
              `Add ${type}`
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
