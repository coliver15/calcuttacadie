'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // POST to server-side login route — session cookie is set in the
    // HTTP response so the server can read it immediately (no browser
    // client encoding mismatch)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, redirectTo }),
      redirect: 'manual', // Handle redirect ourselves
    })

    if (res.status === 0 || res.type === 'opaqueredirect') {
      // Redirect happened — follow it with a hard navigation so
      // the session cookies are included in the next request
      window.location.href = redirectTo
      return
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Login failed' }))
      setError(data.error || 'Login failed')
      setLoading(false)
      return
    }

    // Successful — navigate to dashboard
    window.location.href = redirectTo
  }

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
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            <Button type="submit" loading={loading} className="w-full">Sign In</Button>
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
