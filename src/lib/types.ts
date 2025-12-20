/**
 * Core type definitions for the Postman Clone application
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export interface HeaderRow {
  id: string
  key: string
  value: string
  enabled: boolean
}

export interface ParamRow {
  id: string
  key: string
  value: string
  enabled: boolean
}

export type AuthState =
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }

export interface HistoryEntry {
  id: string
  method: HttpMethod
  url: string
  status?: number
  timeMs?: number
  timestamp: number
}

export interface ResponseSnapshot {
  ok: boolean
  status: number
  statusText: string
  timeMs: number
  size: number
  headers: { key: string; value: string }[]
  body: string
  rawBody: string
  contentType: string
}

export interface Environment {
  id: string
  name: string
  variables: { id: string; key: string; value: string; enabled: boolean }[]
}

export interface SavedRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  headers: HeaderRow[]
  params: ParamRow[]
  body: string
  auth: AuthState
}

// Type guards for validation
export function isHistoryEntry(data: unknown): data is HistoryEntry {
  if (!data || typeof data !== "object") return false
  const entry = data as Record<string, unknown>
  return (
    typeof entry.id === "string" &&
    typeof entry.method === "string" &&
    typeof entry.url === "string" &&
    typeof entry.timestamp === "number"
  )
}

export function isHistoryEntryArray(data: unknown): data is HistoryEntry[] {
  return Array.isArray(data) && data.every(isHistoryEntry)
}

export function isEnvironment(data: unknown): data is Environment {
  if (!data || typeof data !== "object") return false
  const env = data as Record<string, unknown>
  return (
    typeof env.id === "string" &&
    typeof env.name === "string" &&
    Array.isArray(env.variables)
  )
}

export function isEnvironmentArray(data: unknown): data is Environment[] {
  return Array.isArray(data) && data.every(isEnvironment)
}

export function isSavedRequest(data: unknown): data is SavedRequest {
  if (!data || typeof data !== "object") return false
  const req = data as Record<string, unknown>
  return (
    typeof req.id === "string" &&
    typeof req.name === "string" &&
    typeof req.method === "string" &&
    typeof req.url === "string" &&
    Array.isArray(req.headers) &&
    Array.isArray(req.params) &&
    typeof req.body === "string"
  )
}

export function isSavedRequestArray(data: unknown): data is SavedRequest[] {
  return Array.isArray(data) && data.every(isSavedRequest)
}
