import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { NextRequest } from 'next/server'

let dbPath: string

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeAll(() => {
  dbPath = path.join(os.tmpdir(), `test-auth-routes-${Date.now()}-${Math.random()}.db`)
  process.env.DB_PATH = dbPath
})

afterAll(() => {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(dbPath + suffix, { force: true })
})

describe('POST /api/auth/register', () => {
  it('crée un compte et pose le cookie de session', async () => {
    const { POST } = await import('../app/api/auth/register/route')
    const res = await POST(jsonRequest('http://localhost/api/auth/register', {
      email: 'nouveau@example.com', password: 'motdepasse123', name: 'Nouvel Utilisateur',
    }))
    expect(res.status).toBe(200)
    expect(res.cookies.get('pic_session')?.value).toBeTruthy()
  })

  it('refuse un email déjà utilisé', async () => {
    const { POST } = await import('../app/api/auth/register/route')
    const res = await POST(jsonRequest('http://localhost/api/auth/register', {
      email: 'nouveau@example.com', password: 'autremotdepasse', name: 'Doublon',
    }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('refuse un mot de passe trop court', async () => {
    const { POST } = await import('../app/api/auth/register/route')
    const res = await POST(jsonRequest('http://localhost/api/auth/register', {
      email: 'court@example.com', password: '1234567', name: 'X',
    }))
    expect(res.status).toBe(400)
  })

  it('refuse un email invalide', async () => {
    const { POST } = await import('../app/api/auth/register/route')
    const res = await POST(jsonRequest('http://localhost/api/auth/register', {
      email: 'pas-un-email', password: 'motdepasse123', name: 'X',
    }))
    expect(res.status).toBe(400)
  })

  it('refuse un nom vide', async () => {
    const { POST } = await import('../app/api/auth/register/route')
    const res = await POST(jsonRequest('http://localhost/api/auth/register', {
      email: 'sansnom@example.com', password: 'motdepasse123', name: '  ',
    }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  it('refuse un mauvais mot de passe', async () => {
    const { POST } = await import('../app/api/auth/login/route')
    const res = await POST(jsonRequest('http://localhost/api/auth/login', {
      email: 'nouveau@example.com', password: 'mauvais-mot-de-passe',
    }))
    expect(res.status).toBe(401)
  })

  it('refuse un email inconnu', async () => {
    const { POST } = await import('../app/api/auth/login/route')
    const res = await POST(jsonRequest('http://localhost/api/auth/login', {
      email: 'inconnu@example.com', password: 'motdepasse123',
    }))
    expect(res.status).toBe(401)
  })

  it('connecte avec les bons identifiants et pose le cookie de session', async () => {
    const { POST } = await import('../app/api/auth/login/route')
    const res = await POST(jsonRequest('http://localhost/api/auth/login', {
      email: 'nouveau@example.com', password: 'motdepasse123',
    }))
    expect(res.status).toBe(200)
    expect(res.cookies.get('pic_session')?.value).toBeTruthy()
  })

  it('n\'expose jamais le hash du mot de passe dans la réponse', async () => {
    const { POST } = await import('../app/api/auth/login/route')
    const res = await POST(jsonRequest('http://localhost/api/auth/login', {
      email: 'nouveau@example.com', password: 'motdepasse123',
    }))
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('password')
  })
})
