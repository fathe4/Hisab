import { useEffect, useState } from 'react'
import Modal from './Modal'
import Spinner from './Spinner'
import { TrashIcon } from './icons'
import { useCategories } from '../hooks/useCategories'
import { useDeleteTransaction, useSaveTransaction } from '../hooks/useTransactions'
import { todayISO } from '../lib/dates'
import { formatTaka } from '../lib/format'
import type { Transaction, TransactionType } from '../types'

interface TransactionModalProps {
  open: boolean
  onClose: () => void
  /** Pass a transaction to edit, or null to add a new one. */
  initial: Transaction | null
}

export default function TransactionModal({ open, onClose, initial }: TransactionModalProps) {
  const { data: categories = [] } = useCategories()
  const save = useSaveTransaction()
  const del = useDeleteTransaction()

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reset the form each time the modal opens
  useEffect(() => {
    if (!open) return
    setError(null)
    save.reset()
    if (initial) {
      setType(initial.type)
      setAmount(String(initial.amount))
      setCategoryId(initial.category_id)
      setDate(initial.transaction_date)
      setNote(initial.note ?? '')
    } else {
      setType('expense')
      setAmount('')
      setCategoryId('')
      setDate(todayISO())
      setNote('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  const options = categories.filter((c) => c.type === type)

  const switchType = (next: TransactionType) => {
    setType(next)
    // Selected category doesn't belong to the new type — clear it
    if (categoryId && !categories.some((c) => c.id === categoryId && c.type === next)) {
      setCategoryId('')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(amount)
    if (!value || value <= 0) {
      setError('Please enter an amount greater than zero.')
      return
    }
    if (!categoryId) {
      setError('Please choose a category.')
      return
    }
    setError(null)
    try {
      await save.mutateAsync({
        id: initial?.id,
        category_id: categoryId,
        type,
        amount: value,
        note: note.trim() || null,
        transaction_date: date,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  const handleDelete = async () => {
    if (!initial) return
    try {
      await del.mutateAsync(initial.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete. Please try again.')
    }
  }

  const busy = save.isPending || del.isPending

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit transaction' : 'Add transaction'}>
      <form onSubmit={submit} className="space-y-4">
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
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="field w-full text-lg font-semibold"
            autoFocus={!initial}
          />
        </div>

        {/* Category */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Category
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="field w-full"
          >
            <option value="" disabled>
              Choose a category…
            </option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
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

        {/* Note */}
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

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {initial && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="rounded-xl p-2.5 text-rose-500 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-500/10"
              aria-label="Delete transaction"
              title="Delete"
            >
              {del.isPending ? <Spinner className="h-5 w-5 text-rose-500" /> : <TrashIcon />}
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="h-4 w-4 text-white" /> Saving…
              </span>
            ) : initial ? (
              'Save changes'
            ) : (
              `Add ${type}`
            )}
          </button>
        </div>

        {initial && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            {formatTaka(initial.amount)} · tap 🗑 to delete
          </p>
        )}
      </form>
    </Modal>
  )
}
