import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase, authErrorMessage, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Spinner from '../components/Spinner'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="card max-w-sm p-8 text-center shadow-sm">
          <p className="mb-2 text-2xl">⚙️</p>
          <h1 className="mb-2 font-bold">Almost there</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Copy <code className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">.env.example</code> to{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">.env</code>, add your Supabase
            project URL and anon key, then restart the dev server. See README for steps.
          </p>
        </div>
      </div>
    )
  }

  if (!loading && user) return <Navigate to="/" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) {
          setNotice('Account created! Check your email to confirm, then sign in.')
          setMode('signin')
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? authErrorMessage(err.message) : 'Something went wrong. Try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-extrabold text-white shadow-lg shadow-indigo-600/25">
            ৳
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Hisab</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500">Your income &amp; expense tracker</p>
        </div>

        <div className="card p-6 shadow-sm">
          {/* Tabs */}
          <div className="segment mb-5">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setError(null)
                }}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  mode === m
                    ? 'bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-300'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field w-full"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="h-4 w-4 text-white" /> Please wait…
                </span>
              ) : mode === 'signin' ? (
                'Sign in'
              ) : (
                'Create account'
              )}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
          Personal tracker · your data stays private
        </p>
      </div>
    </div>
  )
}
