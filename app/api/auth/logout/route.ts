import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { deleteSession, SESSION_COOKIE } from '@/lib/session'

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (token) deleteSession(token)

  const res = NextResponse.redirect('https://picture.iodev.fr/')
  res.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/', secure: true, sameSite: 'lax' })
  return res
}
