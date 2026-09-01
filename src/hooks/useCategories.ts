import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Category, TransactionType } from '../types'

export const categoryKeys = {
  all: ['categories'] as const,
}

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name')
      if (error) throw error
      return data as Category[]
    },
  })
}

export interface CategoryInput {
  id?: string
  name: string
  type: TransactionType
  color: string
  icon: string | null
}

export function useSaveCategory() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: CategoryInput) => {
      const { id, ...values } = input
      const query = id
        ? supabase.from('categories').update(values).eq('id', id)
        : supabase.from('categories').insert({ ...values, user_id: user!.id })
      const { data, error } = await query.select().single()
      if (error) throw error
      return data as Category
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: categoryKeys.all }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: categoryKeys.all }),
  })
}
