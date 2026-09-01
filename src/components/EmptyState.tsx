import type { ReactNode } from 'react'
import { WalletIcon } from './icons'

export default function EmptyState({
  title,
  hint,
}: {
  title: string
  hint?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
        <WalletIcon width={24} height={24} />
      </div>
      <p className="font-medium text-gray-600 dark:text-gray-300">{title}</p>
      {hint && <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  )
}
