import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type * as AuthModule from '../lib/auth'

let db: Database.Database
let auth: typeof AuthModule
let dbPath: string

beforeAll(async () => {
  dbPath = path.join(os.tmpdir(), `test-login-attempts-${Date.now()}-${Math.random()}.db`)
  db = new Database(dbPath)
  db.exec(`CREATE TABLE login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)
  auth = await import('../lib/auth')
})

describe('rate limiting des tentatives de connexion', () => {
  it('compte les tentatives récentes pour une IP donnée', () => {
    expect(auth.countRecentLoginAttempts(db, '1.2.3.4')).toBe(0)
    auth.recordFailedLoginAttempt(db, '1.2.3.4')
    expect(auth.countRecentLoginAttempts(db, '1.2.3.4')).toBe(1)
    auth.recordFailedLoginAttempt(db, '1.2.3.4')
    expect(auth.countRecentLoginAttempts(db, '1.2.3.4')).toBe(2)
  })

  it('isole le compteur par IP', () => {
    expect(auth.countRecentLoginAttempts(db, '9.9.9.9')).toBe(0)
  })

  it('bloque après LOGIN_ATTEMPT_LIMIT tentatives', () => {
    const ip = '5.5.5.5'
    for (let i = 0; i < auth.LOGIN_ATTEMPT_LIMIT; i++) auth.recordFailedLoginAttempt(db, ip)
    expect(auth.countRecentLoginAttempts(db, ip)).toBeGreaterThanOrEqual(auth.LOGIN_ATTEMPT_LIMIT)
  })
})
