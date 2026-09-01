import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Budget } from '../types'

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*, category:categories(*)')
        .order('created_at')
      if (error) throw error
      return data as Budget[]
    },
  })
}

/** Upserts (or clears, when limit is null) the monthly budget for one category. */
export function useSaveBudget() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { category_id: string; monthly_limit: number | null }) => {
      if (!user) throw new Error('Not signed in')

      if (input.monthly_limit === null) {
        const { error } = await supabase
          .from('budgets')
          .delete()
          .eq('category_id', input.category_id)
        if (error) throw error
        return
      }

      const { error } = await supabase.from('budgets').upsert(
        {
          user_id: user.id,
          category_id: input.category_id,
          monthly_limit: input.monthly_limit,
        },
        { onConflict: 'user_id,category_id' },
      )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })
}
