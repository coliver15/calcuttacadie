// Player-side session auth using HMAC-signed httpOnly cookies.
// Separate from admin auth (cc-session) — players don't have Supabase user accounts;
// they identify by a team access_code and we issue our own session cookie.

import { cookies } from 'next/headers'
import crypto from 'crypto'

export const PLAYER_COOKIE_NAME = 'cc-player'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

export interface PlayerSession {
  team_id: string
  tournament_id: string
  expires_at: number
}

function getSecret(): string {
  return (
    process.env.PLAYER_SESSION_SECRET ||
    'dev-only-insecure-secret-replace-in-production-please'
  )
}

function base64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64urlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4)
  return Buffer.from(padded, 'base64')
}

export function signPayload(payload: PlayerSession): string {
  const json = JSON.stringify(payload)
  const body = base64url(Buffer.from(json, 'utf8'))
  const mac = crypto
    .createHmac('sha256', getSecret())
    .update(body)
    .digest()
  return `${body}.${base64url(mac)}`
}

export function verifyPayload(token: string): PlayerSession | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, mac] = parts
  const expected = base64url(
    crypto.createHmac('sha256', getSecret()).update(body).digest()
  )
  // Constant-time compare
  if (
    expected.length !== mac.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(mac))
  ) {
    return null
  }
  try {
    const payload = JSON.parse(base64urlDecode(body).toString('utf8')) as PlayerSession
    if (!payload.team_id || !payload.tournament_id || !payload.expires_at) return null
    if (payload.expires_at < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function buildSession(team_id: string, tournament_id: string): PlayerSession {
  return {
    team_id,
    tournament_id,
    expires_at: Date.now() + SESSION_TTL_MS,
  }
}

export function getPlayerSession(): PlayerSession | null {
  const c = cookies().get(PLAYER_COOKIE_NAME)
  if (!c?.value) return null
  return verifyPayload(c.value)
}

export function clearPlayerSession() {
  cookies().delete(PLAYER_COOKIE_NAME)
}

export const PLAYER_COOKIE_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000)
