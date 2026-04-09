'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function SignupPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [errors, setErrors] = useState<{
    fullName?: string
    email?: string
    password?: string
    confirmPassword?: string
  }>({})

  function validate(): boolean {
    const newErrors: typeof errors = {}

    if (!fullName.trim()) newErrors.fullName = 'Full name is required'
    if (!email.trim()) newErrors.email = 'Email is required'
    if (password.length < 8)
      newErrors.password = 'Password must be at least 8 characters'
    if (password !== confirmPassword)
      newErrors.confirmPassword = 'Passwords do not match'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-900/50 border border-primary-700">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M5 14l6 6L23 8"
                  stroke="#4ade80"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            We&apos;ve sent a confirmation link to <strong className="text-slate-200">{email}</strong>.
            Click the link to verify your account, then sign in.
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-10">
        <svg width="36" height="36" viewBox="0 0 32 32" fill="none" aria-label="Calcutta">
          <circle cx="16" cy="16" r="15" fill="#052e16" stroke="#16a34a" strokeWidth="1.5" />
          <path d="M10 24V9" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 9l9 3-9 3z" fill="#16a34a" />
          <rect x="17" y="18" width="7" height="3" rx="1" fill="#4ade80" transform="rotate(-35 20 19)" />
          <path d="M20 22l2.5 2.5" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="text-lg font-bold text-white">Calcutta Admin</span>
      </Link>

      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-black/40">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Create an account</h1>
            <p className="text-sm text-slate-400 mt-1">
              Start running Calcutta auctions today
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={errors.fullName}
              required
              placeholder="John Smith"
            />
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              required
              placeholder="you@example.com"
            />
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              required
              placeholder="Minimum 8 characters"
            />
            <Input
              label="Confirm Password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              required
              placeholder="Repeat password"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              className="mt-2"
            >
              Create Account
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
