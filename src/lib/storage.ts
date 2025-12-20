/**
 * Safe localStorage operations with validation
 */

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Safely parse JSON from localStorage with validation
 */
export function safeGetItem<T>(
  key: string,
  validator: (data: unknown) => data is T
): T | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    return validator(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Safely set item in localStorage with serialization
 */
export function safeSetItem<T>(key: string, value: T): boolean {
  if (typeof window === "undefined") return false

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/**
 * Remove item from localStorage
 */
export function safeRemoveItem(key: string): boolean {
  if (typeof window === "undefined") return false

  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
