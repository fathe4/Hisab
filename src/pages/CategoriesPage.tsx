import { useEffect, useMemo, useState } from 'react'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import { PlusIcon, TrashIcon } from '../components/icons'
import { useBudgets, useSaveBudget } from '../hooks/useBudgets'
import { useCategories, useDeleteCategory, useSaveCategory } from '../hooks/useCategories'
import { formatTaka } from '../lib/format'
import type { Category, TransactionType } from '../types'

const COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#22c55e', '#f59e0b',
  '#f97316', '#ec4899', '#8b5cf6', '#14b8a6', '#64748b',
]

const EMOJI_SUGGESTIONS = [
  '🍔', '🚌', '🧾', '🛍️', '💊', '📚', '🎬', '💡', '💼', '💻',
  '💰', '🎁', '✈️', '🏠', '🐾', '☕', '🏋️', '📱', '🎨', '🎮',
]

export default function CategoriesPage() {
  const [tab, setTab] = useState<TransactionType>('expense')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)

  const { data: categories = [] } = useCategories()
  const { data: budgets = [] } = useBudgets()

  const budgetByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of budgets) map.set(b.category_id, Number(b.monthly_limit))
    return map
  }, [budgets])

  const visible = categories.filter((c) => c.type === tab)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-tight">Categories</h1>
        <button
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          <PlusIcon width={18} height={18} /> New category
        </button>
      </div>

      {/* Tabs */}
      <div className="segment max-w-xs">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-2 text-sm font-semibold capitalize transition ${
              tab === t
                ? 'bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-300'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
          No {tab} categories yet — create one to get started.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => {
            const budget = budgetByCategory.get(c.id)
            return (
              <button
                key={c.id}
                onClick={() => {
                  setEditing(c)
                  setModalOpen(true)
                }}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 text-left transition hover:border-indigo-200 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-500/40"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                  style={{ backgroundColor: `${c.color}1A` }}
                >
                  {c.icon ?? '🏷️'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.name}</span>
                  {budget !== undefined ? (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Budget · {formatTaka(budget)}/mo
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300 dark:text-gray-600">
                      {c.type === 'expense' ? 'No budget set' : '—'}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <CategoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        category={editing}
        budgets={budgetByCategory}
      />
    </div>
  )
}

function CategoryModal({
  open,
  onClose,
  category,
  budgets,
}: {
  open: boolean
  onClose: () => void
  category: Category | null
  budgets: Map<string, number>
}) {
  const save = useSaveCategory()
  const saveBudget = useSaveBudget()
  const del = useDeleteCategory()

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🏷️')
  const [color, setColor] = useState(COLORS[0])
  const [type, setType] = useState<TransactionType>('expense')
  const [budget, setBudget] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    save.reset()
    if (category) {
      setName(category.name)
      setIcon(category.icon ?? '🏷️')
      setColor(category.color)
      setType(category.type)
      const b = budgets.get(category.id)
      setBudget(b !== undefined ? String(b) : '')
    } else {
      setName('')
      setIcon('🏷️')
      setColor(COLORS[0])
      setType('expense')
      setBudget('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please give the category a name.')
      return
    }
    setError(null)
    try {
      const saved = await save.mutateAsync({
        id: category?.id,
        name: name.trim(),
        type,
        color,
        icon: icon.trim() || null,
      })

      // Budget applies to expense categories only
      if (saved.type === 'expense') {
        const limit = Number(budget)
        await saveBudget.mutateAsync({
          category_id: saved.id,
          monthly_limit: budget.trim() !== '' && limit > 0 ? limit : null,
        })
      }
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setError(
        msg.includes('duplicate key')
          ? 'You already have a category with this name.'
          : msg.includes('foreign key')
            ? 'This category has transactions and cannot be deleted.'
            : msg,
      )
    }
  }

  const handleDelete = async () => {
    if (!category) return
    setError(null)
    try {
      await del.mutateAsync(category.id)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not delete.'
      setError(
        msg.includes('foreign key')
          ? 'This category has transactions and cannot be deleted. (Rename it instead, or delete its transactions first.)'
          : msg,
      )
    }
  }

  const busy = save.isPending || del.isPending || saveBudget.isPending

  return (
    <Modal open={open} onClose={onClose} title={category ? 'Edit category' : 'New category'}>
      <form onSubmit={submit} className="space-y-4">
        {/* Preview */}
        <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3.5 dark:bg-gray-800">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
            style={{ backgroundColor: `${color}33` }}
          >
            {icon || '🏷️'}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{name.trim() || 'Category name'}</p>
            <p className="text-xs capitalize text-gray-400 dark:text-gray-500">{type}</p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
          <input
            type="text"
            maxLength={40}
            placeholder="e.g. Groceries"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field w-full"
            autoFocus
          />
        </div>

        {/* Type */}
        {!category && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
            <div className="segment">
              {(['expense', 'income'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-lg py-2 text-sm font-semibold capitalize transition ${
                    type === t
                      ? 'bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-300'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Icon */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Icon</label>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_SUGGESTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                className={`h-9 w-9 rounded-lg text-lg transition hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  icon === e
                    ? 'bg-indigo-100 ring-2 ring-indigo-300 dark:bg-indigo-500/20 dark:ring-indigo-500'
                    : 'bg-gray-50 dark:bg-gray-800'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <input
            type="text"
            maxLength={4}
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="Or paste any emoji"
            className="field mt-2 w-full"
          />
        </div>

        {/* Color */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full transition ${
                  color === c
                    ? 'ring-2 ring-gray-800 ring-offset-2 dark:ring-gray-200 dark:ring-offset-gray-900'
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        {/* Budget (expense only) */}
        {type === 'expense' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Monthly budget (৳){' '}
              <span className="font-normal text-gray-400 dark:text-gray-500">
                (optional — leave empty for none)
              </span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 15000"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="field w-full"
            />
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          {category && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="rounded-xl p-2.5 text-rose-500 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-500/10"
              aria-label="Delete category"
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
            ) : (
              'Save'
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
