import { NextResponse } from 'next/server'
import { getSession, listSessions, deleteOtherSessions, SESSION_COOKIE } from '@/lib/session'
import { cookies } from 'next/headers'

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await listSessions(user.id))
}

export async function DELETE() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const count = deleteOtherSessions(user.id, token)
  return NextResponse.json({ deleted: count })
}
