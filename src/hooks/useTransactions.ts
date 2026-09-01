import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Transaction } from '../types'

export const transactionKeys = {
  range: (start: string, end: string) => ['transactions', start, end] as const,
}

/** Fetches transactions between two ISO dates (inclusive), newest first, with joined category. */
export function useTransactions(start: string, end: string) {
  return useQuery({
    queryKey: transactionKeys.range(start, end),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, category:categories(*)')
        .gte('transaction_date', start)
        .lte('transaction_date', end)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Transaction[]
    },
  })
}

export interface TransactionInput {
  id?: string
  category_id: string
  type: 'income' | 'expense'
  amount: number
  note: string | null
  transaction_date: string
}

export function useSaveTransaction() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      const { id, ...values } = input
      const query = id
        ? supabase.from('transactions').update(values).eq('id', id)
        : supabase.from('transactions').insert({ ...values, user_id: user!.id })
      const { data, error } = await query.select().single()
      if (error) throw error
      return data as Transaction
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })
}
