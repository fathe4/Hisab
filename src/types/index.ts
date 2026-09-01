export type TransactionType = 'income' | 'expense'

export interface Category {
  id: string
  user_id: string
  name: string
  type: TransactionType
  color: string
  icon: string | null
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  category_id: string
  type: TransactionType
  amount: number
  note: string | null
  /** ISO date string, e.g. "2026-09-01" */
  transaction_date: string
  created_at: string
  /** Joined from categories on fetch */
  category?: Category
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  monthly_limit: number
  created_at: string
  updated_at: string
  /** Joined from categories on fetch */
  category?: Category
}
