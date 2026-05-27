import { redirect } from 'next/navigation'
import { getPlayerSession } from '@/lib/playerAuth'
import CodeEntryClient from './CodeEntryClient'

interface Props {
  searchParams: { code?: string }
}

export default function PlayLandingPage({ searchParams }: Props) {
  const session = getPlayerSession()
  if (session) {
    redirect('/play/auction')
  }
  const initialCode = (searchParams.code ?? '').toUpperCase().slice(0, 6)
  return <CodeEntryClient initialCode={initialCode} />
}
