import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import MonthSwitcher from '../components/MonthSwitcher'
import TransactionModal from '../components/TransactionModal'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import { PlusIcon, SearchIcon } from '../components/icons'
import { useCategories } from '../hooks/useCategories'
import { useTransactions } from '../hooks/useTransactions'
import { currentMonthKey, formatDay, monthRange } from '../lib/dates'
import { formatTaka } from '../lib/format'
import type { Transaction } from '../types'

type TypeFilter = 'all' | 'income' | 'expense'

export default function TransactionsPage() {
  const location = useLocation()
  const navigate = useNavigate()

  // Arriving from the add page? Open the month the new transaction was dated in.
  const [month, setMonth] = useState(
    () => (location.state as { month?: string } | null)?.month ?? currentMonthKey(),
  )
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [editing, setEditing] = useState<Transaction | null>(null)

  const { data: categories = [] } = useCategories()
  const { start, end } = monthRange(month)
  const { data: transactions = [], isPending, isError } = useTransactions(start, end)

  const monthTotals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of transactions) {
      if (t.type === 'income') income += Number(t.amount)
      else expense += Number(t.amount)
    }
    return { income, expense, net: income - expense }
  }, [transactions])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return transactions.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (categoryFilter !== 'all' && t.category_id !== categoryFilter) return false
      if (q && !(t.note ?? '').toLowerCase().includes(q) && !t.category?.name.toLowerCase().includes(q))
        return false
      return true
    })
  }, [transactions, search, typeFilter, categoryFilter])

  // Group filtered transactions by day, newest first
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of filtered) {
      const list = map.get(t.transaction_date) ?? []
      list.push(t)
      map.set(t.transaction_date, list)
    }
    return [...map.entries()]
  }, [filtered])

  const hasFilters = typeFilter !== 'all' || categoryFilter !== 'all' || search.trim() !== ''

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSwitcher month={month} onChange={setMonth} />
        <button
          onClick={() => navigate('/add')}
          className="hidden items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 sm:inline-flex"
        >
          <PlusIcon width={18} height={18} /> Add transaction
        </button>
      </div>

      {/* Month summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryTile label="Income" value={monthTotals.income} className="text-emerald-600 dark:text-emerald-400" />
        <SummaryTile label="Expenses" value={monthTotals.expense} className="text-rose-600 dark:text-rose-400" />
        <SummaryTile
          label="Net"
          value={monthTotals.net}
          className={monthTotals.net >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}
          signed
        />
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <SearchIcon
            width={16}
            height={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          />
          <input
            type="search"
            placeholder="Search notes or categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field w-full pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="field"
        >
          <option value="all">All types</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="field"
        >
          <option value="all">All categories</option>
          {categories
            .filter((c) => typeFilter === 'all' || c.type === typeFilter)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </option>
            ))}
        </select>
      </div>

      {/* List */}
      {isPending ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-7 w-7" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl bg-rose-50 p-6 text-center text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
          Couldn't load transactions. Check your connection and try again.
        </div>
      ) : groups.length === 0 ? (
        <div className="card">
          <EmptyState
            title={hasFilters ? 'Nothing matches your filters' : 'No transactions this month'}
            hint={
              hasFilters ? (
                'Try clearing the search or filters.'
              ) : (
                <>
                  Tap <Link to="/add" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">+ to record</Link>{' '}
                  your first income or expense.
                </>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, items]) => {
            const dayTotal = items.reduce(
              (sum, t) => sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)),
              0,
            )
            return (
              <section key={date}>
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {formatDay(date)}
                  </h3>
                  <span
                    className={`text-xs font-semibold ${
                      dayTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {dayTotal >= 0 ? '+' : '−'}
                    {formatTaka(Math.abs(dayTotal))}
                  </span>
                </div>
                <div className="card divide-y divide-gray-50 dark:divide-gray-800">
                  {items.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setEditing(t)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                        style={{ backgroundColor: `${t.category?.color ?? '#6366f1'}1A` }}
                      >
                        {t.category?.icon ?? '💸'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {t.category?.name ?? 'Unknown'}
                        </span>
                        {t.note && (
                          <span className="block truncate text-xs text-gray-400 dark:text-gray-500">{t.note}</span>
                        )}
                      </span>
                      <span
                        className={`shrink-0 text-sm font-semibold ${
                          t.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-800 dark:text-gray-100'
                        }`}
                      >
                        {t.type === 'income' ? '+' : '−'}
                        {formatTaka(Number(t.amount))}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Editing happens in the modal; creating has its own page (/add) */}
      {editing && (
        <TransactionModal
          open
          onClose={() => setEditing(null)}
          initial={editing}
        />
      )}
    </div>
  )
}

function SummaryTile({
  label,
  value,
  className,
  signed = false,
}: {
  label: string
  value: number
  className: string
  signed?: boolean
}) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-bold sm:text-base ${className}`}>
        {signed && value > 0 ? '+' : ''}
        {value < 0 ? '−' : ''}
        {formatTaka(Math.abs(value))}
      </p>
    </div>
  )
}
