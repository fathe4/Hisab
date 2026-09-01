import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AiChat from './AiChat'
import ThemeToggle from './ThemeToggle'
import { HomeIcon, ListIcon, LogoutIcon, PlusIcon, TagsIcon } from './icons'

const navItems = [
  { to: '/', label: 'Dashboard', icon: HomeIcon },
  { to: '/add', label: 'New transaction', icon: PlusIcon },
  { to: '/transactions', label: 'Transactions', icon: ListIcon },
  { to: '/categories', label: 'Categories', icon: TagsIcon },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const email = user?.email ?? ''

  return (
    <div className="min-h-dvh">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-gray-100 bg-white lg:flex dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2.5 px-5 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-extrabold text-white">
            ৳
          </div>
          <div>
            <p className="font-extrabold leading-tight">Hisab</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Income &amp; expenses</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-100 p-4 dark:border-gray-800">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-gray-400 dark:text-gray-500" title={email}>
              {email}
            </p>
            <ThemeToggle />
          </div>
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <LogoutIcon /> Log out
          </button>
        </div>
      </aside>

      {/* ---------- Mobile header ---------- */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white/90 px-4 py-3 backdrop-blur lg:hidden dark:border-gray-800 dark:bg-gray-900/90">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-extrabold text-white">
            ৳
          </div>
          <p className="font-extrabold">Hisab</p>
        </div>
        <div className="flex items-center">
          <ThemeToggle />
          <button
            onClick={() => signOut()}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Log out"
          >
            <LogoutIcon />
          </button>
        </div>
      </header>

      {/* ---------- Content ---------- */}
      <main className="pb-28 lg:pb-12 lg:pl-60">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>

      {/* ---------- Mobile bottom nav ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 backdrop-blur lg:hidden dark:border-gray-800 dark:bg-gray-900/95">
        <div className="grid grid-cols-4 items-end px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
          <BottomLink to="/" label="Home" icon={HomeIcon} />
          <BottomLink to="/transactions" label="Records" icon={ListIcon} />

          <button
            onClick={() => navigate('/add')}
            className="mx-auto -mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition active:scale-95"
            aria-label="Add transaction"
          >
            <PlusIcon width={24} height={24} />
          </button>

          <BottomLink to="/categories" label="Categories" icon={TagsIcon} />
        </div>
      </nav>

      {/* AI assistant — floating, available on every page */}
      <AiChat />
    </div>
  )
}

function BottomLink({
  to,
  label,
  icon: Icon,
}: {
  to: string
  label: string
  icon: typeof HomeIcon
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium ${
          isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'
        }`
      }
    >
      <Icon />
      {label}
    </NavLink>
  )
}
