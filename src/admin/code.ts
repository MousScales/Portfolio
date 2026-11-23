export const ADMIN_CODE = '1953'
export const ADMIN_SESSION_KEY = 'cal-admin'

export function adminHeaders(json = false): HeadersInit {
  return {
    ...(json ? { 'content-type': 'application/json' } : {}),
    'x-admin-code': ADMIN_CODE,
  }
}
