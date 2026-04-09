import { Suspense } from 'react'
import Link from 'next/link'
import { loginAction } from '@/app/auth/actions'

interface Props {
  searchParams: Promise<{ error?: string; redirectTo?: string }>
}

async function LoginForm({ searchParams }: Props) {
  const params = await searchParams
  const error = params.error
  const redirectTo = params.redirectTo || '/dashboard'

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⛳</div>
          <h1 className="text-3xl font-bold text-white tracking-widest">CALCUTTA CADDIE</h1>
          <p className="text-slate-400 mt-2">Admin Portal</p>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Sign In</h2>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg p-3 mb-4 text-sm">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action={loginAction} className="space-y-4">
            {/* Pass redirectTo through the form */}
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg px-4 py-2.5 transition-colors"
            >
              Sign In
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-green-400 hover:text-green-300">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage({ searchParams }: Props) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  )
}
