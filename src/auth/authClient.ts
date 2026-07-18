export const AUTH_STORAGE_KEY = 'nissan_purchase_comparison_auth'

export function hasAuthMarker(storage: Storage = localStorage): boolean {
  return storage.getItem(AUTH_STORAGE_KEY) === 'authenticated'
}

export function setAuthMarker(storage: Storage = localStorage): void {
  storage.setItem(AUTH_STORAGE_KEY, 'authenticated')
}

export function clearAuthMarker(storage: Storage = localStorage): void {
  storage.removeItem(AUTH_STORAGE_KEY)
}

async function readMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown }
    return typeof body.message === 'string' ? body.message : fallback
  } catch {
    return fallback
  }
}

export async function checkSession(): Promise<boolean> {
  const response = await fetch('/api/auth/session', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  return response.ok
}

export async function login(password: string): Promise<void> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!response.ok) throw new Error(await readMessage(response, 'ログインできませんでした。'))
  setAuthMarker()
}

export async function logout(): Promise<void> {
  try {
    if (navigator.onLine) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } finally {
    clearAuthMarker()
  }
}
