import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { currentMonthKey, formatDay, formatMonth, todayISO } from '../lib/dates'
import type { Category } from '../types'

export interface RecurringItem {
  id: string
  user_id: string
  name: string
  amount: number
  category_id: string
  due_day: number
  active: boolean
  created_at: string
  category?: Category
}

export interface RecurringPayment {
  id: string
  user_id: string
  recurring_item_id: string
  month: string
  transaction_id: string | null
  amount: number
  paid_on: string
  created_at: string
}

/** All recurring bills (active + paused), with joined category. */
export function useRecurringItems() {
  return useQuery({
    queryKey: ['recurring-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_items')
        .select('*, category:categories(*)')
        .order('due_day')
      if (error) throw error
      return data as RecurringItem[]
    },
  })
}

/** Payments recorded for one month key, e.g. "2026-09". */
export function useRecurringPayments(month: string) {
  return useQuery({
    queryKey: ['recurring-payments', month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_payments')
        .select('*')
        .eq('month', month)
      if (error) throw error
      return data as RecurringPayment[]
    },
  })
}

/**
 * Sum of still-unpaid active bills (overdue + upcoming) for one month and
 * whether the user tracks any active bill at all. Used by the
 * "Expenses + bills due" summary cards.
 */
export function usePendingBillsTotal(month: string) {
  const { data: items = [] } = useRecurringItems()
  const { data: payments = [] } = useRecurringPayments(month)
  return useMemo(() => {
    const byItem = new Map(payments.map((p) => [p.recurring_item_id, p]))
    let pendingTotal = 0
    let hasBills = false
    for (const item of items) {
      if (!item.active) continue
      hasBills = true
      const view = buildBillView(item, byItem.get(item.id), month)
      if (view.status === 'overdue' || view.status === 'upcoming') {
        pendingTotal += Number(item.amount)
      }
    }
    return { pendingTotal, hasBills }
  }, [items, payments, month])
}

export interface RecurringItemInput {
  id?: string
  name: string
  amount: number
  category_id: string
  due_day: number
  active: boolean
}

export function useSaveRecurringItem() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: RecurringItemInput) => {
      const { id, ...values } = input
      const query = id
        ? supabase.from('recurring_items').update(values).eq('id', id)
        : supabase.from('recurring_items').insert({ ...values, user_id: user!.id })
      const { data, error } = await query.select().single()
      if (error) throw error
      return data as RecurringItem
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-items'] }),
  })
}

export function useDeleteRecurringItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-items'] }),
  })
}

/** Marks a bill paid: RPC inserts the payment AND a real expense transaction atomically. */
export function useMarkPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      item: RecurringItem
      month: string
      amount: number
      paidOn: string
      note: string | null
    }) => {
      const { data, error } = await supabase.rpc('mark_recurring_paid', {
        p_item: input.item.id,
        p_month: input.month,
        p_amount: input.amount,
        p_paid_on: input.paidOn,
        p_note: input.note,
      })
      if (error) throw error
      return data as RecurringPayment
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-payments'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

/** Undo: RPC removes the payment and its linked transaction together. */
export function useUnmarkPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payment: RecurringPayment) => {
      const { error } = await supabase.rpc('unmark_recurring_paid', { p_payment: payment.id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-payments'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

// ---------- Status derivation (pure, no cron needed) ----------

export type BillStatus = 'paid' | 'overdue' | 'upcoming' | 'unpaid'

export interface BillView {
  item: RecurringItem
  payment?: RecurringPayment
  status: BillStatus
  /** Days late when overdue */
  daysLate: number
  /** e.g. "Due Sep 25" / "Paid Sep 10" */
  statusLabel: string
  /** Sort rank: overdue first, then upcoming by due day, then paid, then unpaid-past */
  sortRank: number
}

/**
 * Derives a bill's display state for the viewed month.
 * - Payment exists            → paid
 * - Unpaid, current month:
 *     today ≤ due_day         → upcoming ("pay early" still just shows Paid once done)
 *     today > due_day         → overdue
 * - Unpaid, past month        → unpaid (dim)
 * - Future month              → upcoming
 */
export function buildBillView(
  item: RecurringItem,
  payment: RecurringPayment | undefined,
  month: string,
): BillView {
  const now = new Date()
  const currentKey = currentMonthKey()

  if (payment) {
    return {
      item,
      payment,
      status: 'paid',
      daysLate: 0,
      statusLabel: `Paid ${formatDay(payment.paid_on)}`,
      sortRank: 2,
    }
  }

  if (month < currentKey) {
    return { item, payment, status: 'unpaid', daysLate: 0, statusLabel: 'Not paid', sortRank: 3 }
  }

  if (month === currentKey) {
    const daysLate = now.getDate() - item.due_day
    if (daysLate > 0) {
      return {
        item,
        payment,
        status: 'overdue',
        daysLate,
        statusLabel:
          daysLate === 1 ? 'Due passed · 1 day late' : `Due passed · ${daysLate} days late`,
        sortRank: 0,
      }
    }
    return {
      item,
      payment,
      status: 'upcoming',
      daysLate: 0,
      statusLabel: `Due ${formatDay(`${month}-${String(item.due_day).padStart(2, '0')}`)}`,
      sortRank: 1,
    }
  }

  return {
    item,
    payment,
    status: 'upcoming',
    daysLate: 0,
    statusLabel: `Due ${formatDay(`${month}-${String(item.due_day).padStart(2, '0')}`)}`,
    sortRank: 1,
  }
}

/** Pre-filled note for a payment, e.g. "Home Rent · September 2026" */
export function paymentNote(item: RecurringItem, month: string): string {
  return `${item.name} · ${formatMonth(month)}`
}

/** Default pay date: today for the current month, else the due day of the viewed month. */
export function defaultPayDate(month: string, dueDay: number): string {
  const currentKey = currentMonthKey()
  if (month === currentKey) return todayISO()
  return `${month}-${String(Math.min(dueDay, 28)).padStart(2, '0')}`
}
