import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { env } from '../env'

const ACCESS_SECRET = new TextEncoder().encode(env.JWT_ACCESS_SECRET)
const REFRESH_SECRET = new TextEncoder().encode(env.JWT_REFRESH_SECRET)

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export interface TokenPayload {
  sub: string       // userId
  orgId: string
  role: string
  plan: string
}

export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ orgId: payload.orgId, role: payload.role, plan: payload.plan })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(ACCESS_SECRET)
}

export async function signRefreshToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ orgId: payload.orgId, role: payload.role, plan: payload.plan })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(REFRESH_SECRET)
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, ACCESS_SECRET)
  return {
    sub: payload.sub as string,
    orgId: payload['orgId'] as string,
    role: payload['role'] as string,
    plan: payload['plan'] as string,
  }
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, REFRESH_SECRET)
  return {
    sub: payload.sub as string,
    orgId: payload['orgId'] as string,
    role: payload['role'] as string,
    plan: payload['plan'] as string,
  }
}

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
}
