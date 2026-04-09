'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData) {
  const email      = formData.get('email')      as string
  const password   = formData.get('password')   as string
  const redirectTo = (formData.get('redirectTo') as string) || '/dashboard'

  try {
    // Note: cookies() is synchronous in Next.js 14 — no await needed
    const cookieStore = cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return redirect(
        `/auth/login?error=${encodeURIComponent(error.message)}&redirectTo=${encodeURIComponent(redirectTo)}`
      )
    }

    return redirect(redirectTo)

  } catch (err: unknown) {
    // Re-throw Next.js redirect errors (they use throw internally)
    if (
      err instanceof Error &&
      (err.message === 'NEXT_REDIRECT' || (err as any).digest?.startsWith('NEXT_REDIRECT'))
    ) {
      throw err
    }

    // Surface any unexpected error on the login page
    const message = err instanceof Error ? err.message : String(err)
    return redirect(
      `/auth/login?error=${encodeURIComponent(`Server error: ${message}`)}&redirectTo=${encodeURIComponent(redirectTo)}`
    )
  }
}
