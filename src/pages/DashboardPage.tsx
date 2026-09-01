import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import MonthSwitcher from '../components/MonthSwitcher'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import { TrendingDownIcon, TrendingUpIcon, WalletIcon } from '../components/icons'
import { useTheme } from '../hooks/useTheme'
import { useBudgets } from '../hooks/useBudgets'
import { buildBillView, useRecurringItems, useRecurringPayments } from '../hooks/useRecurring'
import { useTransactions } from '../hooks/useTransactions'
import { currentMonthKey, formatDay, formatMonth, lastNMonthKeys, monthsBackRange, shortMonth } from '../lib/dates'
import { formatTaka } from '../lib/format'
import type { Transaction } from '../types'

const CHART_MONTHS = 6

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonthKey())
  const { isDark } = useTheme()

  const { start, end } = useMemo(() => monthsBackRange(month, CHART_MONTHS), [month])
  const { data: transactions = [], isPending } = useTransactions(start, end)
  const { data: budgets = [] } = useBudgets()
  const { data: recurringItems = [] } = useRecurringItems()
  const { data: recurringPayments = [] } = useRecurringPayments(month)

  // Chart colors adapt to the theme
  const gridStroke = isDark ? '#374151' : '#f1f5f9'
  const cursorFill = isDark ? '#1f2937' : '#f8fafc'
  const tooltipStyle = {
    borderRadius: 12,
    border: `1px solid ${isDark ? '#374151' : '#f1f5f9'}`,
    backgroundColor: isDark ? '#111827' : '#ffffff',
    color: isDark ? '#f3f4f6' : '#111827',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
    fontSize: 13,
  }

  // ---- Derived data ----
  const currentTx = useMemo(
    () => transactions.filter((t) => t.transaction_date.startsWith(month)),
    [transactions, month],
  )

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of currentTx) {
      if (t.type === 'income') income += Number(t.amount)
      else expense += Number(t.amount)
    }
    return { income, expense, net: income - expense }
  }, [currentTx])

  const chartData = useMemo(() => {
    return lastNMonthKeys(month, CHART_MONTHS).map((key) => {
      let income = 0
      let expense = 0
      for (const t of transactions) {
        if (!t.transaction_date.startsWith(key)) continue
        if (t.type === 'income') income += Number(t.amount)
        else expense += Number(t.amount)
      }
      return { month: shortMonth(key), key, income, expense }
    })
  }, [transactions, month])

  const donutData = useMemo(() => {
    const byCat = new Map<string, number>()
    for (const t of currentTx) {
      if (t.type !== 'expense') continue
      const label = t.category?.name ?? 'Other'
      byCat.set(label, (byCat.get(label) ?? 0) + Number(t.amount))
    }
    return [...byCat.entries()]
      .map(([name, value]) => {
        const cat = currentTx.find((t) => t.category?.name === name)?.category
        return { name, value, color: cat?.color ?? '#94a3b8' }
      })
      .sort((a, b) => b.value - a.value)
  }, [currentTx])

  const budgetRows = useMemo(() => {
    const spendByCat = new Map<string, number>()
    for (const t of currentTx) {
      if (t.type !== 'expense') continue
      spendByCat.set(t.category_id, (spendByCat.get(t.category_id) ?? 0) + Number(t.amount))
    }
    return budgets
      .filter((b) => b.category)
      .map((b) => {
        const spent = spendByCat.get(b.category_id) ?? 0
        const limit = Number(b.monthly_limit)
        return {
          id: b.id,
          name: b.category!.name!,
          icon: b.category!.icon,
          color: b.category!.color,
          spent,
          limit,
          pct: Math.min(100, Math.round((spent / limit) * 100)),
          over: spent > limit,
        }
      })
      .sort((a, b) => b.pct - a.pct)
  }, [budgets, currentTx])

  const recent = useMemo(
    () => [...currentTx].slice(0, 5),
    [currentTx],
  )

  const billViews = useMemo(() => {
    const byItem = new Map(recurringPayments.map((p) => [p.recurring_item_id, p]))
    return recurringItems
      .filter((i) => i.active)
      .map((i) => buildBillView(i, byItem.get(i.id), month))
      .sort((a, b) => a.sortRank - b.sortRank || a.item.due_day - b.item.due_day)
  }, [recurringItems, recurringPayments, month])

  const billsPaid = billViews.filter((v) => v.status === 'paid')
  const billsPending = billViews.filter((v) => v.status === 'overdue' || v.status === 'upcoming')
  const billsRemaining = billsPending.reduce((s, v) => s + Number(v.item.amount), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Welcome back 👋 here's your month at a glance
          </p>
        </div>
        <MonthSwitcher month={month} onChange={setMonth} />
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Income"
              value={formatTaka(totals.income)}
              icon={<TrendingUpIcon />}
              tone="emerald"
            />
            <StatCard
              label="Expenses"
              value={formatTaka(totals.expense)}
              icon={<TrendingDownIcon />}
              tone="rose"
            />
            <StatCard
              label="Net balance"
              value={`${totals.net < 0 ? '−' : ''}${formatTaka(Math.abs(totals.net))}`}
              icon={<WalletIcon />}
              tone={totals.net >= 0 ? 'indigo' : 'rose'}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {/* 6-month bar chart */}
            <section className="card p-5 lg:col-span-3">
              <h2 className="mb-4 text-sm font-semibold text-gray-500 dark:text-gray-400">
                Income vs expenses · last {CHART_MONTHS} months
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={4}>
                    <CartesianGrid vertical={false} stroke={gridStroke} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                    />
                    <Tooltip
                      cursor={{ fill: cursorFill }}
                      formatter={(value) => formatTaka(Number(value))}
                      contentStyle={tooltipStyle}
                    />
                    <Bar dataKey="income" name="Income" fill="#34d399" radius={[6, 6, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="expense" name="Expense" fill="#fb7185" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Expense donut */}
            <section className="card p-5 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold text-gray-500 dark:text-gray-400">
                Expenses by category
              </h2>
              {donutData.length === 0 ? (
                <EmptyState
                  title="No expenses this month"
                  hint="They'll show up here as a breakdown."
                />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {donutData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatTaka(Number(value))}
                        contentStyle={tooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="-mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
                    {donutData.slice(0, 5).map((d) => (
                      <span
                        key={d.name}
                        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                        {d.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Recurring bills overview */}
          {billViews.length > 0 && (
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                  Upcoming payments · {formatMonth(month)}
                </h2>
                <Link
                  to="/transactions"
                  className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Mark paid →
                </Link>
              </div>
              <div className="flex h-2.5 gap-1 overflow-hidden">
                {billViews.map((v) => (
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
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm">
                  <span className="font-bold">
                    {billsPaid.length} of {billViews.length}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500"> bills paid</span>
                  {billsPending.length > 0 && (
                    <span className="text-gray-400 dark:text-gray-500">
                      {' '}
                      · {formatTaka(billsRemaining)} remaining
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {billsPending.slice(0, 3).map((v) => (
                    <span key={v.item.id} className="flex items-center gap-1.5 text-xs">
                      <span>{v.item.category?.icon ?? '🧾'}</span>
                      <span
                        className={
                          v.status === 'overdue'
                            ? 'font-semibold text-rose-600 dark:text-rose-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }
                      >
                        {v.item.name} · {v.statusLabel}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {/* Budgets */}
            <section className="card p-5 lg:col-span-3">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                  Budgets · this month
                </h2>
                <Link
                  to="/categories"
                  className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Manage →
                </Link>
              </div>
              {budgetRows.length === 0 ? (
                <EmptyState
                  title="No budgets yet"
                  hint="Set a monthly limit on any expense category."
                />
              ) : (
                <ul className="space-y-4">
                  {budgetRows.map((b) => (
                    <li key={b.id}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {b.icon ? `${b.icon} ` : ''}
                          {b.name}
                        </span>
                        <span
                          className={`font-semibold ${
                            b.over ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {formatTaka(b.spent)}{' '}
                          <span className="font-normal text-gray-400 dark:text-gray-500">
                            / {formatTaka(b.limit)}
                          </span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${b.pct}%`,
                            backgroundColor: b.over ? '#f43f5e' : b.pct >= 80 ? '#f59e0b' : b.color,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Recent transactions */}
            <section className="card p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Recent</h2>
                <Link
                  to="/transactions"
                  className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  View all →
                </Link>
              </div>
              {recent.length === 0 ? (
                <EmptyState title="Nothing recorded yet" hint="Add your first transaction." />
              ) : (
                <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                  {recent.map((t: Transaction) => (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${t.category?.color ?? '#6366f1'}1A` }}
                      >
                        {t.category?.icon ?? '💸'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.category?.name ?? '—'}</p>
                        <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                          {formatDay(t.transaction_date)}
                          {t.note ? ` · ${t.note}` : ''}
                        </p>
                      </div>
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
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone: 'emerald' | 'rose' | 'indigo'
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
  }
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400 dark:text-gray-500">{label}</p>
        <p className="truncate text-lg font-extrabold tracking-tight">{value}</p>
      </div>
    </div>
  )
}
