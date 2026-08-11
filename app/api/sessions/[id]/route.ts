import { NextRequest, NextResponse } from 'next/server'
import { getSession, deleteSessionById } from '@/lib/session'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  deleteSessionById(user.id, parseInt(params.id, 10))
  return NextResponse.json({ ok: true })
}
