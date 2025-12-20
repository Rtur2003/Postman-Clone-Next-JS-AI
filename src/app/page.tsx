"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import {
  Clock3,
  Copy,
  Database,
  History as HistoryIcon,
  Loader2,
  Moon,
  Save,
  SendHorizontal,
  Shield,
  SlidersHorizontal,
  Sun,
  Trash2,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
type HeaderRow = { id: string; key: string; value: string; enabled: boolean }
type ParamRow = { id: string; key: string; value: string; enabled: boolean }
type AuthState =
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }
type HistoryEntry = {
  id: string
  method: HttpMethod
  url: string
  status?: number
  timeMs?: number
  timestamp: number
}
type ResponseSnapshot = {
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
type Environment = {
  id: string
  name: string
  variables: { id: string; key: string; value: string; enabled: boolean }[]
}
type SavedRequest = {
  id: string
  name: string
  method: HttpMethod
  url: string
  headers: HeaderRow[]
  params: ParamRow[]
  body: string
  auth: AuthState
}

const HISTORY_STORAGE_KEY = "postman_clone_history_v1"
const ENV_STORAGE_KEY = "postman_clone_envs_v1"
const COLLECTION_STORAGE_KEY = "postman_clone_saved_requests_v1"
const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"]
const DEFAULT_URL = "https://jsonplaceholder.typicode.com/posts/1"
const HISTORY_LIMIT = 25

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

const formatBytes = (size?: number) => {
  if (size === undefined || Number.isNaN(size)) return "-"
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

const statusVariant = (
  status?: number
): "default" | "secondary" | "destructive" | "outline" => {
  if (!status) return "secondary"
  if (status >= 200 && status < 300) return "default"
  if (status >= 400) return "destructive"
  return "outline"
}

const tryFormatJson = (payload: string) => {
  try {
    return JSON.stringify(JSON.parse(payload), null, 2)
  } catch {
    return payload
  }
}

const applyVariables = (
  value: string,
  variables: Environment["variables"]
) => {
  return value.replace(/{{(.*?)}}/g, (_match, key) => {
    const found = variables.find(
      (variable) => variable.enabled && variable.key === key.trim()
    )
    return found ? found.value : ""
  })
}

const buildUrlWithParams = (url: string, params: ParamRow[]) => {
  const enabled = params.filter((p) => p.enabled && p.key.trim())
  if (enabled.length === 0) return url
  const urlObj = new URL(url)
  enabled.forEach((param) => {
    urlObj.searchParams.set(param.key.trim(), param.value.trim())
  })
  return urlObj.toString()
}

const parseParamsFromUrl = (url: string): ParamRow[] => {
  try {
    const urlObj = new URL(url)
    return Array.from(urlObj.searchParams.entries()).map(([key, value]) => ({
      id: createId(),
      key,
      value,
      enabled: true,
    }))
  } catch {
    return []
  }
}

export default function Home() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [method, setMethod] = React.useState<HttpMethod>("GET")
  const [url, setUrl] = React.useState(DEFAULT_URL)
  const [headers, setHeaders] = React.useState<HeaderRow[]>([
    { id: createId(), key: "Accept", value: "application/json", enabled: true },
  ])
  const [queryParams, setQueryParams] = React.useState<ParamRow[]>(
    parseParamsFromUrl(DEFAULT_URL)
  )
  const [auth, setAuth] = React.useState<AuthState>({ type: "none" })
  const [body, setBody] = React.useState('{\n  "title": "Hello from Postman Clone"\n}')
  const [response, setResponse] = React.useState<ResponseSnapshot | null>(null)
  const [history, setHistory] = React.useState<HistoryEntry[]>([])
  const [savedRequests, setSavedRequests] = React.useState<SavedRequest[]>([])
  const [activeEnv, setActiveEnv] = React.useState<string | null>(null)
  const [environments, setEnvironments] = React.useState<Environment[]>([
    { id: "env-default", name: "Local", variables: [] },
  ])
  const [saveName, setSaveName] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [responseView, setResponseView] = React.useState<"pretty" | "raw">("pretty")

  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const savedHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY)
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory) as HistoryEntry[])
      } catch {
        // ignore malformed history
      }
    }

    const savedEnvs = window.localStorage.getItem(ENV_STORAGE_KEY)
    if (savedEnvs) {
      try {
        const parsed = JSON.parse(savedEnvs) as Environment[]
        setEnvironments(parsed)
        setActiveEnv(parsed[0]?.id ?? null)
      } catch {
        // ignore malformed envs
      }
    } else {
      setActiveEnv("env-default")
    }

    const savedCollection = window.localStorage.getItem(COLLECTION_STORAGE_KEY)
    if (savedCollection) {
      try {
        setSavedRequests(JSON.parse(savedCollection) as SavedRequest[])
      } catch {
        // ignore malformed saved requests
      }
    }
  }, [])

  const persistHistory = React.useCallback((items: HistoryEntry[]) => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(items.slice(0, HISTORY_LIMIT))
    )
  }, [])

  const persistEnvironments = React.useCallback((envs: Environment[]) => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(ENV_STORAGE_KEY, JSON.stringify(envs))
  }, [])

  const persistSavedRequests = React.useCallback(
    (items: SavedRequest[]) => {
      if (typeof window === "undefined") return
      window.localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(items))
    },
    []
  )

  const pushHistory = React.useCallback(
    (entry: HistoryEntry) => {
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, HISTORY_LIMIT)
        persistHistory(next)
        return next
      })
    },
    [persistHistory]
  )

  const clearHistory = React.useCallback(() => {
    setHistory([])
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY)
    }
  }, [])

  const updateHeader = React.useCallback(
    (id: string, field: keyof Omit<HeaderRow, "id">, value: string | boolean) =>
      setHeaders((current) =>
        current.map((header) =>
          header.id === id ? { ...header, [field]: value } : header
        )
      ),
    []
  )

  const removeHeader = React.useCallback(
    (id: string) => setHeaders((current) => current.filter((item) => item.id !== id)),
    []
  )

  const addHeaderRow = React.useCallback(
    () =>
      setHeaders((current) => [
        ...current,
        { id: createId(), key: "", value: "", enabled: true },
      ]),
    []
  )

  const updateParam = React.useCallback(
    (id: string, field: keyof Omit<ParamRow, "id">, value: string | boolean) =>
      setQueryParams((current) =>
        current.map((param) =>
          param.id === id ? { ...param, [field]: value } : param
        )
      ),
    []
  )

  const removeParam = React.useCallback(
    (id: string) => setQueryParams((current) => current.filter((item) => item.id !== id)),
    []
  )

  const addParamRow = React.useCallback(
    () =>
      setQueryParams((current) => [
        ...current,
        { id: createId(), key: "", value: "", enabled: true },
      ]),
    []
  )

  const syncParamsFromUrl = React.useCallback(() => {
    setQueryParams(parseParamsFromUrl(url))
  }, [url])

  const addEnvironment = React.useCallback(() => {
    setEnvironments((current) => {
      const next = [
        ...current,
        { id: createId(), name: `Env ${current.length + 1}`, variables: [] },
      ]
      persistEnvironments(next)
      return next
    })
  }, [persistEnvironments])

  const updateEnvironmentVariables = React.useCallback(
    (
      envId: string,
      update: (vars: Environment["variables"]) => Environment["variables"]
    ) => {
      setEnvironments((current) => {
        const next = current.map((env) =>
          env.id === envId ? { ...env, variables: update(env.variables) } : env
        )
        persistEnvironments(next)
        return next
      })
    },
    [persistEnvironments]
  )

  const updateEnvironmentName = React.useCallback(
    (envId: string, name: string) => {
      setEnvironments((current) => {
        const next = current.map((env) =>
          env.id === envId ? { ...env, name } : env
        )
        persistEnvironments(next)
        return next
      })
    },
    [persistEnvironments]
  )

  const removeEnvironment = React.useCallback(
    (envId: string) => {
      setEnvironments((current) => {
        const filtered = current.filter((env) => env.id !== envId)
        persistEnvironments(filtered)
        if (activeEnv === envId) {
          setActiveEnv(filtered[0]?.id ?? null)
        }
        return filtered
      })
    },
    [activeEnv, persistEnvironments]
  )

  const saveCurrentRequest = React.useCallback(
    (name: string) => {
      const newRequest: SavedRequest = {
        id: createId(),
        name,
        method,
        url,
        headers,
        params: queryParams,
        body,
        auth,
      }
      setSavedRequests((current) => {
        const next = [newRequest, ...current]
        persistSavedRequests(next)
        return next
      })
    },
    [auth, body, headers, method, persistSavedRequests, queryParams, url]
  )

  const applySavedRequest = React.useCallback((request: SavedRequest) => {
    setMethod(request.method)
    setUrl(request.url)
    setHeaders(request.headers)
    setQueryParams(request.params)
    setBody(request.body)
    setAuth(request.auth)
    setResponse(null)
    setErrorMessage(null)
  }, [])

  const applyHistoryEntry = React.useCallback(
    (entry: HistoryEntry) => {
      setMethod(entry.method)
      setUrl(entry.url)
      setQueryParams(parseParamsFromUrl(entry.url))
      setResponse(null)
      setErrorMessage(null)
    },
    []
  )

  const handleSend = React.useCallback(async () => {
    if (!url.trim()) {
      setErrorMessage("Please enter a URL.")
      return
    }

    setSending(true)
    setResponse(null)
    setErrorMessage(null)

    const start = performance.now()
    const currentEnvVars =
      environments.find((env) => env.id === activeEnv)?.variables ?? []

    const resolvedHeaders = headers.map((header) => ({
      ...header,
      key: applyVariables(header.key, currentEnvVars),
      value: applyVariables(header.value, currentEnvVars),
    }))

    const activeHeaders = resolvedHeaders
      .filter((item) => item.enabled && item.key.trim())
      .reduce<Record<string, string>>((acc, curr) => {
        acc[curr.key.trim()] = curr.value.trim()
        return acc
      }, {})

    if (auth.type === "bearer" && auth.token.trim()) {
      activeHeaders["Authorization"] = `Bearer ${applyVariables(
        auth.token,
        currentEnvVars
      )}`
    }

    if (auth.type === "basic" && auth.username) {
      const user = applyVariables(auth.username, currentEnvVars)
      const pass = applyVariables(auth.password, currentEnvVars)
      activeHeaders["Authorization"] = `Basic ${btoa(`${user}:${pass}`)}`
    }

    const init: RequestInit = {
      method,
      headers: activeHeaders,
    }

    const resolvedBody = applyVariables(body, currentEnvVars)
    const hasBody = method !== "GET" && resolvedBody.trim().length > 0
    const looksLikeJson =
      resolvedBody.trim().startsWith("{") || resolvedBody.trim().startsWith("[")
    const hasContentType = Object.keys(activeHeaders).some(
      (key) => key.toLowerCase() === "content-type"
    )

    if (hasBody) {
      if (!hasContentType && looksLikeJson) {
        activeHeaders["Content-Type"] = "application/json"
      }
      init.body = resolvedBody
    }

    const resolvedParams = queryParams.map((param) => ({
      ...param,
      key: applyVariables(param.key, currentEnvVars),
      value: applyVariables(param.value, currentEnvVars),
    }))

    const resolvedUrl = applyVariables(url, currentEnvVars)

    let finalUrl = resolvedUrl
    try {
      finalUrl = buildUrlWithParams(resolvedUrl, resolvedParams)
    } catch {
      setSending(false)
      setErrorMessage("Invalid URL. Please check the value or variables.")
      return
    }

    try {
      const res = await fetch(finalUrl, init)
      const text = await res.text()
      const elapsed = Math.round(performance.now() - start)
      const size =
        typeof TextEncoder !== "undefined"
          ? new TextEncoder().encode(text).length
          : text.length
      const contentType = res.headers.get("content-type") ?? "unknown"
      const headerEntries = Array.from(res.headers.entries()).map(
        ([key, value]) => ({ key, value })
      )

      setResponse({
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        timeMs: elapsed,
        size,
        headers: headerEntries,
        body:
          contentType.includes("application/json") || looksLikeJson
            ? tryFormatJson(text || "")
            : text || "Empty body",
        rawBody: text,
        contentType,
      })

      pushHistory({
        id: createId(),
        method,
        url: finalUrl,
        status: res.status,
        timeMs: elapsed,
        timestamp: Date.now(),
      })
    } catch (error) {
      const elapsed = Math.round(performance.now() - start)
      setErrorMessage(
        error instanceof Error ? error.message : "Request failed."
      )
      pushHistory({
        id: createId(),
        method,
        url: finalUrl,
        timeMs: elapsed,
        timestamp: Date.now(),
      })
    } finally {
      setSending(false)
    }
  }, [activeEnv, auth, body, environments, headers, method, pushHistory, queryParams, url])

  const themeIsDark = mounted && theme === "dark"
  const currentEnv =
    environments.find((env) => env.id === activeEnv) ?? environments[0] ?? null
  const currentEnvVars = currentEnv?.variables ?? []
  const copyToClipboard = React.useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // ignore copy failures
    }
  }, [])

  const prettyBody =
    response && response.contentType.includes("application/json")
      ? tryFormatJson(response.rawBody || "")
      : response?.body ?? ""

  const displayedBody =
    responseView === "pretty" ? prettyBody : response?.rawBody ?? ""

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="border-b bg-card/30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg text-sm font-semibold">
              AI
            </div>
            <div>
              <div className="text-lg font-semibold">Postman Clone</div>
              <p className="text-muted-foreground text-sm">
                Build, send, and inspect HTTP requests.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTheme(themeIsDark ? "light" : "dark")}
              disabled={!mounted}
            >
              {themeIsDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-6">
        <ResizablePanelGroup direction="horizontal" className="gap-4">
          <ResizablePanel defaultSize={55} minSize={40} className="flex flex-col gap-4">
            <Card>
              <CardHeader className="border-b pb-4">
                <CardTitle>Request</CardTitle>
                <CardDescription>
                  Configure the method, target, headers, and body.
                </CardDescription>
                <CardAction>
                  <Button onClick={handleSend} disabled={sending}>
                    {sending ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <SendHorizontal className="mr-2 size-4" />
                        Send
                      </>
                    )}
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium text-foreground">
                    Method & URL
                  </Label>
                  <div className="flex flex-col gap-2 md:flex-row">
                    <Select value={method} onValueChange={(value: HttpMethod) => setMethod(value)}>
                      <SelectTrigger className="md:w-32">
                        <SelectValue placeholder="Metod" />
                      </SelectTrigger>
                      <SelectContent>
                        {METHODS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      placeholder="https://api.example.com/resource"
                      className="flex-1"
                    />
                  </div>
                </div>

                <Tabs defaultValue="params" className="flex flex-col gap-3">
                  <TabsList>
                    <TabsTrigger value="params">Params</TabsTrigger>
                    <TabsTrigger value="headers">Headers</TabsTrigger>
                    <TabsTrigger value="body">Body</TabsTrigger>
                    <TabsTrigger value="auth">Auth</TabsTrigger>
                    <TabsTrigger value="environment">Environment</TabsTrigger>
                    <TabsTrigger value="saved">Saved</TabsTrigger>
                  </TabsList>

                  <TabsContent value="params" className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={addParamRow}>
                        Add param
                      </Button>
                      <Button variant="ghost" size="sm" onClick={syncParamsFromUrl}>
                        <SlidersHorizontal className="mr-2 size-4" />
                        Sync from URL
                      </Button>
                      <p className="text-muted-foreground text-xs">
                        Params are appended to the request URL.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {queryParams.length === 0 ? (
                        <div className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-sm">
                          No params added. Click &quot;Add param&quot; to create one.
                        </div>
                      ) : (
                        queryParams.map((param) => (
                          <div
                            key={param.id}
                            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-2"
                          >
                            <Input
                              placeholder="Key"
                              value={param.key}
                              onChange={(event) =>
                                updateParam(param.id, "key", event.target.value)
                              }
                            />
                            <Input
                              placeholder="Value"
                              value={param.value}
                              onChange={(event) =>
                                updateParam(param.id, "value", event.target.value)
                              }
                            />
                            <Button
                              variant={param.enabled ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => updateParam(param.id, "enabled", !param.enabled)}
                            >
                              {param.enabled ? "On" : "Off"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeParam(param.id)}
                              aria-label="Delete param"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="headers" className="space-y-3">
                    <div className="space-y-2">
                      {headers.map((header) => (
                        <div
                          key={header.id}
                          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-2"
                        >
                          <Input
                            placeholder="Key"
                            value={header.key}
                            onChange={(event) =>
                              updateHeader(header.id, "key", event.target.value)
                            }
                          />
                          <Input
                            placeholder="Value"
                            value={header.value}
                            onChange={(event) =>
                              updateHeader(header.id, "value", event.target.value)
                            }
                          />
                          <Button
                            variant={header.enabled ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => updateHeader(header.id, "enabled", !header.enabled)}
                          >
                            {header.enabled ? "On" : "Off"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeHeader(header.id)}
                            aria-label="Delete header"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={addHeaderRow}>
                        Add header
                      </Button>
                      <p className="text-muted-foreground text-xs">
                        Empty rows are ignored.
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="body" className="space-y-2">
                    <Label htmlFor="body">Request body</Label>
                    <Textarea
                      id="body"
                      value={body}
                      disabled={method === "GET"}
                      onChange={(event) => setBody(event.target.value)}
                      className="font-mono"
                      rows={10}
                      placeholder='{"title": "Hello"}'
                    />
                    <p className="text-muted-foreground text-xs">
                      GET requests do not send a body.
                    </p>
                  </TabsContent>

                  <TabsContent value="auth" className="space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <div className="md:w-48">
                        <Label>Auth type</Label>
                        <Select
                          value={auth.type}
                          onValueChange={(value: AuthState["type"]) => {
                            if (value === "none") setAuth({ type: "none" })
                            if (value === "bearer")
                              setAuth({ type: "bearer", token: "" })
                            if (value === "basic")
                              setAuth({ type: "basic", username: "", password: "" })
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Auth" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="bearer">Bearer</SelectItem>
                            <SelectItem value="basic">Basic</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {auth.type === "bearer" && (
                        <div className="flex flex-1 flex-col gap-2">
                          <Label htmlFor="bearer-token">Bearer token</Label>
                          <Input
                            id="bearer-token"
                            placeholder="eyJhbGciOi..."
                            value={auth.token}
                            onChange={(event) =>
                              setAuth({ type: "bearer", token: event.target.value })
                            }
                          />
                        </div>
                      )}
                      {auth.type === "basic" && (
                        <div className="flex flex-1 flex-col gap-2">
                          <Label>Username</Label>
                          <Input
                            placeholder="user"
                            value={auth.username}
                            onChange={(event) =>
                              setAuth({
                                type: "basic",
                                username: event.target.value,
                                password: auth.password,
                              })
                            }
                          />
                          <Label>Password</Label>
                          <Input
                            placeholder="******"
                            type="password"
                            value={auth.password}
                            onChange={(event) =>
                              setAuth({
                                type: "basic",
                                username: auth.username,
                                password: event.target.value,
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                    <Alert>
                      <Shield className="size-4" />
                      <AlertTitle>Variable support</AlertTitle>
                      <AlertDescription>
                        You can reference environment variables in auth fields using
                        {" {{KEY}}"} syntax.
                      </AlertDescription>
                    </Alert>
                  </TabsContent>

                  <TabsContent value="environment" className="space-y-3">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                        <div className="md:w-48">
                          <Label>Active environment</Label>
                          <Select
                            value={currentEnv?.id}
                            onValueChange={(value) => setActiveEnv(value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select environment" />
                            </SelectTrigger>
                            <SelectContent>
                              {environments.map((env) => (
                                <SelectItem key={env.id} value={env.id}>
                                  {env.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <Input
                            value={currentEnv?.name ?? ""}
                            onChange={(event) =>
                              currentEnv &&
                              updateEnvironmentName(currentEnv.id, event.target.value)
                            }
                            placeholder="Environment name"
                            className="md:w-64"
                          />
                          <Button variant="outline" size="sm" onClick={addEnvironment}>
                            New environment
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => currentEnv && removeEnvironment(currentEnv.id)}
                            disabled={!currentEnv || environments.length === 1}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {(currentEnvVars ?? []).map((variable) => (
                          <div
                            key={variable.id}
                            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-2"
                          >
                            <Input
                              placeholder="Key"
                              value={variable.key}
                              onChange={(event) =>
                                currentEnv &&
                                updateEnvironmentVariables(currentEnv.id, (vars) =>
                                  vars.map((item) =>
                                    item.id === variable.id
                                      ? { ...item, key: event.target.value }
                                      : item
                                  )
                                )
                              }
                            />
                            <Input
                              placeholder="Value"
                              value={variable.value}
                              onChange={(event) =>
                                currentEnv &&
                                updateEnvironmentVariables(currentEnv.id, (vars) =>
                                  vars.map((item) =>
                                    item.id === variable.id
                                      ? { ...item, value: event.target.value }
                                      : item
                                  )
                                )
                              }
                            />
                            <Button
                              variant={variable.enabled ? "secondary" : "outline"}
                              size="sm"
                              onClick={() =>
                                currentEnv &&
                                updateEnvironmentVariables(currentEnv.id, (vars) =>
                                  vars.map((item) =>
                                    item.id === variable.id
                                      ? { ...item, enabled: !item.enabled }
                                      : item
                                  )
                                )
                              }
                            >
                              {variable.enabled ? "On" : "Off"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                currentEnv &&
                                updateEnvironmentVariables(currentEnv.id, (vars) =>
                                  vars.filter((item) => item.id !== variable.id)
                                )
                              }
                              aria-label="Delete variable"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            currentEnv &&
                            updateEnvironmentVariables(currentEnv.id, (vars) => [
                              ...vars,
                              { id: createId(), key: "", value: "", enabled: true },
                            ])
                          }
                          disabled={!currentEnv}
                        >
                          Add variable
                        </Button>
                        <p className="text-muted-foreground text-xs">
                          Use variables anywhere with {"{{KEY}}"} syntax.
                        </p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="saved" className="space-y-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                      <Input
                        placeholder="Request name"
                        value={saveName}
                        onChange={(event) => setSaveName(event.target.value)}
                        className="md:w-64"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!saveName.trim()) return
                          saveCurrentRequest(saveName.trim())
                          setSaveName("")
                        }}
                      >
                        <Save className="mr-2 size-4" />
                        Save current
                      </Button>
                    </div>
                    <div className="bg-muted/30 divide-y rounded-lg border">
                      {savedRequests.length === 0 ? (
                        <div className="text-muted-foreground px-4 py-3 text-sm">
                          No saved requests yet. Save one to see it here.
                        </div>
                      ) : (
                        savedRequests.map((request) => (
                          <div
                            key={request.id}
                            className="flex items-center justify-between gap-3 px-4 py-3"
                          >
                            <div className="flex flex-1 items-center gap-2">
                              <Badge variant="outline">{request.method}</Badge>
                              <span className="truncate text-sm font-medium">
                                {request.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => applySavedRequest(request)}
                              >
                                Load
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Delete saved request"
                                onClick={() =>
                                  setSavedRequests((current) => {
                                    const next = current.filter((item) => item.id !== request.id)
                                    persistSavedRequests(next)
                                    return next
                                  })
                                }
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b pb-4">
                <CardTitle>History</CardTitle>
                <CardDescription>Stored only in this browser.</CardDescription>
                <CardAction>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearHistory}
                    disabled={!history.length}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Clear
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[320px]">
                  <div className="divide-y">
                    {history.length === 0 ? (
                      <div className="text-muted-foreground px-6 py-4 text-sm">
                        No requests yet. Send one to see it here.
                      </div>
                    ) : (
                      history.map((entry) => (
                        <button
                          key={entry.id}
                          className="hover:bg-accent/60 flex w-full items-start gap-3 px-6 py-3 text-left transition"
                          onClick={() => applyHistoryEntry(entry)}
                        >
                          <Badge variant={statusVariant(entry.status)}>
                            {entry.status ?? "-"}
                          </Badge>
                          <div className="flex flex-1 flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{entry.method}</Badge>
                              <span className="truncate text-sm font-medium">{entry.url}</span>
                            </div>
                            <div className="text-muted-foreground flex items-center gap-2 text-xs">
                              <HistoryIcon className="size-3.5" />
                              <span>
                                {entry.timeMs ? `${entry.timeMs} ms` : "-"} |{" "}
                                {new Date(entry.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={45} minSize={35}>
            <Card className="h-full">
              <CardHeader className="border-b pb-4">
                <CardTitle>Response</CardTitle>
                <CardDescription>Status, time, size, and body.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="border-input bg-muted/40 rounded-lg border p-3">
                    <p className="text-muted-foreground text-xs">Status</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={statusVariant(response?.status)}>
                        {response ? response.status : "-"}
                      </Badge>
                      <span className="text-sm">
                        {response ? response.statusText : "Not sent"}
                      </span>
                    </div>
                  </div>
                  <div className="border-input bg-muted/40 rounded-lg border p-3">
                    <p className="text-muted-foreground text-xs">Time</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Clock3 className="size-4 text-muted-foreground" />
                      <span className="text-sm">
                        {response ? `${response.timeMs} ms` : "-"}
                      </span>
                    </div>
                  </div>
                  <div className="border-input bg-muted/40 rounded-lg border p-3">
                    <p className="text-muted-foreground text-xs">Size</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Database className="size-4 text-muted-foreground" />
                      <span className="text-sm">
                        {response ? formatBytes(response.size) : "-"}
                      </span>
                    </div>
                  </div>
                </div>
                {response?.contentType && (
                  <div className="text-muted-foreground text-xs">
                    Content-Type: {response.contentType}
                  </div>
                )}

                {errorMessage && (
                  <Alert variant="destructive">
                    <AlertTitle>Request failed</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                {response ? (
                  <Tabs defaultValue="body" className="flex flex-1 flex-col gap-3">
                    <TabsList>
                      <TabsTrigger value="body">Body</TabsTrigger>
                      <TabsTrigger value="headers">Headers</TabsTrigger>
                    </TabsList>
                    <TabsContent
                      value="body"
                      className="flex-1 overflow-hidden rounded-lg border"
                    >
                      <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={responseView === "pretty" ? "secondary" : "ghost"}
                            onClick={() => setResponseView("pretty")}
                          >
                            Pretty
                          </Button>
                          <Button
                            size="sm"
                            variant={responseView === "raw" ? "secondary" : "ghost"}
                            onClick={() => setResponseView("raw")}
                          >
                            Raw
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(displayedBody)}
                        >
                          <Copy className="mr-2 size-4" />
                          Copy body
                        </Button>
                      </div>
                      <pre className="bg-muted/40 h-full w-full overflow-auto p-4 text-sm">
                        {displayedBody || "No body"}
                      </pre>
                      {response.contentType.includes("text/event-stream") && (
                        <div className="text-muted-foreground border-t px-4 py-2 text-xs">
                          Streaming/SSE responses show the text received so far.
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="headers" className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs">
                        <span>Response headers</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            copyToClipboard(
                              response.headers
                                .map((header) => `${header.key}: ${header.value}`)
                                .join("\n")
                            )
                          }
                        >
                          <Copy className="mr-2 size-4" />
                          Copy headers
                        </Button>
                      </div>
                      <div className="bg-muted/40 divide-y rounded-b-lg border">
                        {response.headers.length === 0 ? (
                          <div className="text-muted-foreground p-4 text-sm">
                            Server returned no headers.
                          </div>
                        ) : (
                          response.headers.map((header) => (
                            <div
                              key={`${header.key}-${header.value}`}
                              className="flex items-center justify-between gap-4 px-4 py-2 text-sm"
                            >
                              <span className="font-medium">{header.key}</span>
                              <span className="text-muted-foreground break-all">
                                {header.value}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="border-dashed text-muted-foreground flex flex-1 items-center justify-center rounded-lg border text-sm">
                    Send a request to see the response.
                  </div>
                )}
              </CardContent>
            </Card>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  )
}
