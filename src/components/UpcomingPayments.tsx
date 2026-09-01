import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import Spinner from './Spinner'
import { CheckIcon, ChevronDownIcon, PlusIcon } from './icons'
import { useCategories } from '../hooks/useCategories'
import {
  buildBillView,
  defaultPayDate,
  paymentNote,
  useDeleteRecurringItem,
  useMarkPaid,
  useRecurringItems,
  useRecurringPayments,
  useSaveRecurringItem,
  useUnmarkPaid,
  type BillView,
  type RecurringItem,
  type RecurringPayment,
} from '../hooks/useRecurring'
import { currentMonthKey, formatMonth } from '../lib/dates'
import { formatTaka } from '../lib/format'

/**
 * "Upcoming payments" section on the transactions page: fixed monthly bills
 * with per-month pending/paid status. Marking paid records both the payment
 * and the real expense transaction (atomic RPC).
 */
export default function UpcomingPayments({ month }: { month: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<RecurringItem | null>(null)
  const [paying, setPaying] = useState<RecurringItem | null>(null)
  const [confirmUndo, setConfirmUndo] = useState<{ payment: RecurringPayment; name: string } | null>(
    null,
  )

  const { data: items = [] } = useRecurringItems()
  const { data: payments = [] } = useRecurringPayments(month)
  const unmark = useUnmarkPaid()

  const paymentByItem = useMemo(() => {
    const map = new Map<string, RecurringPayment>()
    for (const p of payments) map.set(p.recurring_item_id, p)
    return map
  }, [payments])

  const { activeViews, pausedItems, paidCount, pendingTotal, paidTotal } = useMemo(() => {
    const views = items
      .filter((i) => i.active)
      .map((i) => buildBillView(i, paymentByItem.get(i.id), month))
      .sort((a, b) => a.sortRank - b.sortRank || a.item.due_day - b.item.due_day)
    return {
      activeViews: views,
      pausedItems: items.filter((i) => !i.active),
      paidCount: views.filter((v) => v.status === 'paid').length,
      pendingTotal: views
        .filter((v) => v.status === 'overdue' || v.status === 'upcoming')
        .reduce((s, v) => s + Number(v.item.amount), 0),
      paidTotal: views
        .filter((v) => v.status === 'paid')
        .reduce((s, v) => s + Number(v.payment!.amount), 0),
    }
  }, [items, paymentByItem, month])

  // Modals must be mounted in BOTH branches (empty state + list) so the
  // section-header Add button works before the first bill exists.
  const modals = (
    <>
      <RecurringItemModal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        item={editingItem}
      />
      <MarkPaidModal item={paying} month={month} onClose={() => setPaying(null)} />

      <Modal open={confirmUndo !== null} onClose={() => setConfirmUndo(null)} title="Remove payment?">
        {confirmUndo && (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This removes the payment for{' '}
              <strong className="text-gray-700 dark:text-gray-200">{confirmUndo.name}</strong> and
              <strong className="text-gray-700 dark:text-gray-200"> deletes its expense transaction</strong> from{' '}
              {formatMonth(confirmUndo.payment.month)}.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmUndo(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await unmark.mutateAsync(confirmUndo.payment)
                  setConfirmUndo(null)
                }}
                disabled={unmark.isPending}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
              >
                {unmark.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  )

  if (items.length === 0) {
    // First-time discovery: a quiet one-liner so the feature can be found
    return (
      <>
      <section className="card flex items-center gap-3 px-4 py-3 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-base dark:bg-indigo-500/15">
          🧾
        </span>
        <p className="min-w-0 flex-1 text-sm text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-700 dark:text-gray-200">Upcoming payments</span>{' '}
          — track rent &amp; fixed bills due each month
        </p>
        <button
          onClick={() => {
            setEditingItem(null)
            setItemModalOpen(true)
          }}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
        >
          <PlusIcon width={14} height={14} /> Add
        </button>
      </section>
      {modals}
      </>
    )
  }

  const allDone = activeViews.length > 0 && paidCount === activeViews.length
  const isCurrentMonth = month === currentMonthKey()

  return (
    <section className="card overflow-hidden">
      {/* ---------- Header ---------- */}
      <div className="flex items-center gap-2 px-4 py-3 sm:px-5">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!collapsed}
        >
          <ChevronDownIcon
            width={16}
            height={16}
            className={`shrink-0 text-gray-400 transition-transform ${collapsed ? '-rotate-90' : ''}`}
          />
          <span className="truncate text-sm font-semibold text-gray-500 dark:text-gray-400">
            Upcoming payments · {formatMonth(month)}
          </span>
          <span
            className={`ml-1 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              allDone
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
            }`}
          >
            {allDone ? 'All paid ✓' : `${activeViews.length - paidCount} pending`}
          </span>
        </button>
        <button
          onClick={() => {
            setEditingItem(null)
            setItemModalOpen(true)
          }}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
        >
          <PlusIcon width={14} height={14} /> Add
        </button>
      </div>

      {!collapsed && (
        <div className="border-t border-gray-50 dark:border-gray-800">
          {/* ---------- Progress ---------- */}
          {activeViews.length > 0 && (
            <div className="px-4 pt-3 sm:px-5">
              <div className="flex h-2 gap-1 overflow-hidden">
                {activeViews.map((v) => (
                  <div
                    key={v.item.id}
                    className="flex-1 rounded-full transition-colors"
                    style={{
                      backgroundColor:
                        v.status === 'paid'
                          ? '#10b981'
                          : v.status === 'overdue'
                            ? '#f43f5e'
                            : '#fcd34d',
                    }}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                {formatTaka(paidTotal)} paid
                {!allDone && ` · ${formatTaka(pendingTotal)} remaining`}
              </p>
            </div>
          )}

          {/* ---------- Rows ---------- */}
          <ul className="mt-2 divide-y divide-gray-50 dark:divide-gray-800">
            {activeViews.map((v) => (
              <BillRow
                key={v.item.id}
                view={v}
                canPay={isCurrentMonth}
                onPay={() => setPaying(v.item)}
                onUndo={() => setConfirmUndo({ payment: v.payment!, name: v.item.name })}
                onEdit={() => {
                  setEditingItem(v.item)
                  setItemModalOpen(true)
                }}
              />
            ))}
          </ul>

          {/* ---------- Paused ---------- */}
          {pausedItems.length > 0 && (
            <div className="border-t border-dashed border-gray-200 px-4 py-2 dark:border-gray-700 sm:px-5">
              <p className="mb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-300 dark:text-gray-600">
                Paused
              </p>
              <ul>
                {pausedItems.map((item) => (
                  <PausedRow
                    key={item.id}
                    item={item}
                    onEdit={() => {
                      setEditingItem(item)
                      setItemModalOpen(true)
                    }}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ---------- Modals ---------- */}
      {modals}
    </section>
  )
}

// ================= Row =================

function BillRow({
  view,
  canPay,
  onPay,
  onUndo,
  onEdit,
}: {
  view: BillView
  canPay: boolean
  onPay: () => void
  onUndo: () => void
  onEdit: () => void
}) {
  const { item, status, statusLabel } = view

  if (status === 'paid') {
    return (
      <li className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
          <CheckIcon width={16} height={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">{item.name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {formatTaka(Number(view.payment!.amount))} · {statusLabel}
          </p>
        </div>
        <button
          onClick={onUndo}
          title="Remove this payment and its transaction"
          className="shrink-0 text-xs font-semibold text-gray-400 transition hover:text-rose-500 dark:hover:text-rose-400"
        >
          Undo
        </button>
        <button
          onClick={onEdit}
          className="shrink-0 text-xs font-semibold text-gray-400 transition hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          Edit
        </button>
      </li>
    )
  }

  const accent =
    status === 'overdue'
      ? 'border-l-rose-500'
      : status === 'upcoming'
        ? 'border-l-amber-400'
        : 'border-l-gray-200 dark:border-l-gray-700'

  const chipCls =
    status === 'overdue'
      ? 'text-rose-600 dark:text-rose-400'
      : status === 'upcoming'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-gray-400 dark:text-gray-500'

  return (
    <li className={`border-l-[3px] ${accent}`}>
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <button
          onClick={onEdit}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={`Edit ${item.name}`}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
            style={{ backgroundColor: `${item.category?.color ?? '#6366f1'}1A` }}
          >
            {item.category?.icon ?? '🧾'}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{item.name}</span>
            <span className={`block truncate text-xs font-medium ${chipCls}`}>
              {formatTaka(Number(item.amount))} · {statusLabel}
            </span>
          </span>
        </button>
        {canPay && status !== 'unpaid' && (
          <button
            onClick={onPay}
            className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 active:scale-95"
          >
            Mark paid
          </button>
        )}
      </div>
    </li>
  )
}

function PausedRow({ item, onEdit }: { item: RecurringItem; onEdit: () => void }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-base opacity-50 dark:bg-gray-800">
        {item.category?.icon ?? '🧾'}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-gray-400 dark:text-gray-500">
        {item.name} · {formatTaka(Number(item.amount))}
      </span>
      <button
        onClick={onEdit}
        className="shrink-0 text-xs font-semibold text-indigo-500 hover:underline dark:text-indigo-400"
      >
        Resume / edit
      </button>
    </li>
  )
}

// ================= Mark-paid modal =================

function MarkPaidModal({
  item,
  month,
  onClose,
}: {
  item: RecurringItem | null
  month: string
  onClose: () => void
}) {
  const mark = useMarkPaid()
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Prefill whenever a bill is opened for payment
  useEffect(() => {
    if (!item) return
    setAmount(String(item.amount))
    setPaidOn(defaultPayDate(month, item.due_day))
    setNote(paymentNote(item, month))
    setError(null)
    mark.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, month])

  if (!item) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(amount)
    if (!value || value <= 0) {
      setError('Please enter an amount greater than zero.')
      return
    }
    setError(null)
    try {
      await mark.mutateAsync({ item, month, amount: value, paidOn, note: note.trim() || null })
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setError(msg.includes('Already paid') ? 'This bill is already marked paid for the month.' : msg)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Mark paid · ${item.name}`}>
      <form onSubmit={submit} className="space-y-4">
        {/* Read-only category summary */}
        <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3.5 dark:bg-gray-800">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
            style={{ backgroundColor: `${item.category?.color ?? '#6366f1'}33` }}
          >
            {item.category?.icon ?? '🧾'}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{item.category?.name ?? 'Expense'}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Default {formatTaka(Number(item.amount))} · {formatMonth(month)}
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Amount paid (৳)
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="field w-full text-lg font-semibold"
            autoFocus
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Bills vary — edit if this month was different.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Date
            </label>
            <input
              type="date"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              className="field w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Note
            </label>
            <input
              type="text"
              maxLength={200}
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

        <button
          type="submit"
          disabled={mark.isPending}
          className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
        >
          {mark.isPending ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="h-4 w-4 text-white" /> Saving…
            </span>
          ) : (
            `Mark paid · ${formatTaka(Number(amount) || 0)}`
          )}
        </button>
      </form>
    </Modal>
  )
}

// ================= Add / Edit item modal =================

export function RecurringItemModal({
  open,
  onClose,
  item,
}: {
  open: boolean
  onClose: () => void
  item: RecurringItem | null
}) {
  const { data: categories = [] } = useCategories()
  const save = useSaveRecurringItem()
  const del = useDeleteRecurringItem()

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [dueDay, setDueDay] = useState(1)
  const [active, setActive] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reset when the sheet opens
  useEffect(() => {
    if (!open) return
    setError(null)
    setConfirmDelete(false)
    save.reset()
    if (item) {
      setName(item.name)
      setAmount(String(item.amount))
      setCategoryId(item.category_id)
      setDueDay(item.due_day)
      setActive(item.active)
    } else {
      setName('')
      setAmount('')
      setCategoryId('')
      setDueDay(1)
      setActive(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  const expenseCategories = categories.filter((c) => c.type === 'expense')
  const selected = expenseCategories.find((c) => c.id === categoryId)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(amount)
    if (!name.trim()) return setError('Please give the bill a name.')
    if (!value || value <= 0) return setError('Please enter an amount greater than zero.')
    if (!categoryId) return setError('Please choose a category.')
    setError(null)
    try {
      await save.mutateAsync({
        id: item?.id,
        name: name.trim(),
        amount: value,
        category_id: categoryId,
        due_day: dueDay,
        active,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  const handleDelete = async () => {
    if (!item) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      window.setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    try {
      await del.mutateAsync(item.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit recurring bill' : 'New recurring bill'}>
      <form onSubmit={submit} className="space-y-4">
        {/* Preview */}
        <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3.5 dark:bg-gray-800">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
            style={{ backgroundColor: `${selected?.color ?? '#6366f1'}33` }}
          >
            {selected?.icon ?? '🧾'}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{name.trim() || 'Bill name'}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {amount && Number(amount) > 0 ? formatTaka(Number(amount)) : '৳0'} · every month · due
              day {dueDay}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Name
            </label>
            <input
              type="text"
              maxLength={40}
              placeholder="e.g. Home Rent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field w-full"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Amount (৳)
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="15000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="field w-full"
            />
          </div>
        </div>

        {/* Category chips */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Expense category
          </label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {expenseCategories.map((c) => {
              const isSelected = categoryId === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(isSelected ? '' : c.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 text-center transition ${
                    isSelected
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-700/60'
                  }`}
                  style={isSelected ? { backgroundColor: c.color } : undefined}
                >
                  <span className="text-lg leading-none">{c.icon ?? '🏷️'}</span>
                  <span className="w-full truncate text-[11px] font-medium">{c.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Due day stepper */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Due day of month
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDueDay((d) => Math.max(1, d - 1))}
              className="h-9 w-9 shrink-0 rounded-full border border-gray-200 text-lg font-semibold text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              aria-label="Decrease due day"
            >
              −
            </button>
            <span className="w-10 text-center text-lg font-bold">{dueDay}</span>
            <button
              type="button"
              onClick={() => setDueDay((d) => Math.min(28, d + 1))}
              className="h-9 w-9 shrink-0 rounded-full border border-gray-200 text-lg font-semibold text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              aria-label="Increase due day"
            >
              +
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Paying early is always fine — this is just the deadline.
            </span>
          </div>
        </div>

        {/* Active toggle (edit only) */}
        {item && (
          <button
            type="button"
            onClick={() => setActive((a) => !a)}
            className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <span>
              <span className="block text-sm font-medium">Active</span>
              <span className="block text-xs text-gray-400 dark:text-gray-500">
                Paused bills are hidden from the monthly list.
              </span>
            </span>
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  active ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </span>
          </button>
        )}

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          {item && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={save.isPending || del.isPending}
              className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition disabled:opacity-50 ${
                confirmDelete
                  ? 'bg-rose-600 text-white hover:bg-rose-500'
                  : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'
              }`}
            >
              {confirmDelete ? 'Tap again to confirm' : 'Delete'}
            </button>
          )}
          <button
            type="submit"
            disabled={save.isPending}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {save.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="h-4 w-4 text-white" /> Saving…
              </span>
            ) : (
              'Save'
            )}
          </button>
        </div>
        {item && !confirmDelete && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            Deleting a bill keeps its past transactions in your records.
          </p>
        )}
      </form>
    </Modal>
  )
}
