const numberFormat = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** Formats an amount as Bangladeshi Taka, e.g. ৳12,500.50 */
export function formatTaka(amount: number): string {
  return `৳${numberFormat.format(amount)}`
}

/** Same as formatTaka but prefixes - for display of expenses where needed. */
export function formatSignedTaka(amount: number, type: 'income' | 'expense'): string {
  return `${type === 'expense' ? '−' : '+'}${formatTaka(amount)}`
}
