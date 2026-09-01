import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { addMonths, currentMonthKey, formatMonth } from '../lib/dates'

interface MonthSwitcherProps {
  month: string
  onChange: (month: string) => void
}

export default function MonthSwitcher({ month, onChange }: MonthSwitcherProps) {
  const isCurrent = month === currentMonthKey()

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(addMonths(month, -1))}
        className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        aria-label="Previous month"
      >
        <ChevronLeftIcon />
      </button>
      <div className="w-36 text-center text-sm font-semibold sm:w-40">
        {formatMonth(month)}
      </div>
      <button
        onClick={() => onChange(addMonths(month, 1))}
        disabled={isCurrent}
        className="rounded-full p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-800 dark:disabled:hover:bg-transparent"
        aria-label="Next month"
      >
        <ChevronRightIcon />
      </button>
    </div>
  )
}
