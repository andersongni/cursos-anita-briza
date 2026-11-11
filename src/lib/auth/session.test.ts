import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStore),
}))

import {
  ACTIVITY_REFRESH_THROTTLE_SECONDS,
  clearSessionCookie,
  clearSessionCookieOnResponse,
  COOKIE_NAME,
  createToken,
  getLastActivityAt,
  getSession,
  getSessionFromRequest,
  IDLE_TIMEOUT_SECONDS,
  isSessionIdle,
  refreshSessionActivity,
  sessionCookieOptions,
  setSessionCookie,
  setSessionCookieOnResponse,
  shouldRefreshActivity,
  verifyToken,
  type SessionPayload,
} from './session'

const base: SessionPayload = {
  userId: 'u1',
  username: 'ana',
  role: 'STUDENT',
  status: 'APPROVED',
  sessionVersion: 1,
}

describe('session helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('JWT_SECRET', 'test-jwt-secret')
  })

  it('activity / idle', () => {
    expect(getLastActivityAt({ ...base })).toBeNull()
    expect(getLastActivityAt({ ...base, iat: 10 })).toBe(10)
    expect(getLastActivityAt({ ...base, lastActivityAt: 20 })).toBe(20)
    expect(isSessionIdle({ ...base })).toBe(true)
    expect(
      isSessionIdle({ ...base, lastActivityAt: Math.floor(Date.now() / 1000) })
    ).toBe(false)
    expect(
      isSessionIdle({
        ...base,
        lastActivityAt: Math.floor(Date.now() / 1000) - IDLE_TIMEOUT_SECONDS - 1,
      })
    ).toBe(true)
    expect(shouldRefreshActivity({ ...base })).toBe(true)
    expect(
      shouldRefreshActivity({
        ...base,
        lastActivityAt: Math.floor(Date.now() / 1000),
      })
    ).toBe(false)
    expect(
      shouldRefreshActivity({
        ...base,
        lastActivityAt:
          Math.floor(Date.now() / 1000) - ACTIVITY_REFRESH_THROTTLE_SECONDS,
      })
    ).toBe(true)
  })

  it('cookie options e token roundtrip', async () => {
    expect(sessionCookieOptions().httpOnly).toBe(true)
    const token = await createToken({ ...base, iat: 1 })
    const verified = await verifyToken(token)
    expect(verified?.userId).toBe('u1')
    expect(verified?.lastActivityAt).toBeTypeOf('number')
    expect(await verifyToken('bad')).toBeNull()

    const refreshed = await refreshSessionActivity(verified!)
    expect(await verifyToken(refreshed)).toBeTruthy()
  })

  it('cookies helpers', async () => {
    cookieStore.get.mockReturnValueOnce(undefined)
    expect(await getSession()).toBeNull()

    const token = await createToken(base)
    cookieStore.get.mockReturnValueOnce({ value: token })
    expect((await getSession())?.username).toBe('ana')

    await setSessionCookie(token)
    expect(cookieStore.set).toHaveBeenCalledWith(
      COOKIE_NAME,
      token,
      expect.any(Object)
    )
    await clearSessionCookie()
    expect(cookieStore.delete).toHaveBeenCalledWith(COOKIE_NAME)

    const req = {
      cookies: { get: vi.fn().mockReturnValueOnce(undefined) },
    } as never
    expect(await getSessionFromRequest(req)).toBeNull()

    const req2 = {
      cookies: { get: vi.fn().mockReturnValueOnce({ value: token }) },
    } as never
    expect((await getSessionFromRequest(req2))?.userId).toBe('u1')

    const response = {
      cookies: { set: vi.fn(), delete: vi.fn() },
    }
    setSessionCookieOnResponse(response as never, token)
    clearSessionCookieOnResponse(response as never)
    expect(response.cookies.set).toHaveBeenCalled()
    expect(response.cookies.delete).toHaveBeenCalledWith(COOKIE_NAME)
  })
})
