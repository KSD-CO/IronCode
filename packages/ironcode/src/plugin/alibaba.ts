import type { Hooks, PluginInput } from "@ironcode-ai/plugin"

const CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56"
const DEVICE_CODE_URL = "https://chat.qwen.ai/api/v1/oauth2/device/code"
const TOKEN_URL = "https://chat.qwen.ai/api/v1/oauth2/token"
const OAUTH_API_BASE_URL = "https://portal.qwen.ai/v1"
const OAUTH_POLLING_SAFETY_MARGIN_MS = 3000

// --- PKCE helpers (same as codex.ts) ---
async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandomString(43)
  const encoder = new TextEncoder()
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(verifier))
  const challenge = base64UrlEncode(hash)
  return { verifier, challenge }
}

function generateRandomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("")
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

interface QwenTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  expiry_date?: number
  token_type?: string
  error?: string
  interval?: number
}

async function refreshQwenToken(refreshToken: string): Promise<QwenTokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }).toString(),
  })
  if (!response.ok) throw new Error(`Token refresh failed: ${response.status}`)
  return response.json()
}

export async function AlibabaAuthPlugin(input: PluginInput): Promise<Hooks> {
  const sdk = input.client
  return {
    auth: {
      provider: "alibaba",
      async loader(getAuth, provider) {
        const auth = await getAuth()
        if (!auth || auth.type !== "oauth") return {}

        const providerID = provider?.id ?? "alibaba"

        return {
          baseURL: OAUTH_API_BASE_URL,
          apiKey: "dummy",
          async fetch(request: RequestInfo | URL, init?: RequestInit) {
            let currentAuth = await getAuth()
            if (currentAuth.type !== "oauth") return fetch(request, init)

            // Refresh token if expiring within 60 seconds
            if (currentAuth.expires < Date.now() + 60_000) {
              try {
                const tokens = await refreshQwenToken(currentAuth.refresh)
                if (tokens.access_token) {
                  const expires = tokens.expiry_date ?? Date.now() + (tokens.expires_in ?? 3600) * 1000
                  await sdk.auth.set({
                    path: { id: providerID },
                    body: {
                      type: "oauth",
                      access: tokens.access_token,
                      refresh: tokens.refresh_token ?? currentAuth.refresh,
                      expires,
                    },
                  })
                  currentAuth = await getAuth()
                  // Re-check type after re-assignment
                  if (currentAuth.type !== "oauth") return fetch(request, init)
                }
              } catch {}
            }

            // Re-read auth to get definitive narrowed type after potential refresh
            const finalAuth = await getAuth()
            if (finalAuth.type !== "oauth") return fetch(request, init)

            // Build headers with Bearer token
            const headers = new Headers()
            if (init?.headers) {
              if (init.headers instanceof Headers) {
                init.headers.forEach((value, key) => headers.set(key, value))
              } else if (Array.isArray(init.headers)) {
                for (const [key, value] of init.headers) {
                  if (value !== undefined) headers.set(key, String(value))
                }
              } else {
                for (const [key, value] of Object.entries(init.headers)) {
                  if (value !== undefined) headers.set(key, String(value))
                }
              }
            }
            headers.delete("authorization")
            headers.delete("Authorization")
            headers.set("Authorization", `Bearer ${finalAuth.access}`)

            return fetch(request, { ...init, headers })
          },
        }
      },
      methods: [
        {
          type: "oauth",
          label: "Login with Qwen account",
          async authorize() {
            const pkce = await generatePKCE()

            const deviceResponse = await fetch(DEVICE_CODE_URL, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: CLIENT_ID,
                scope: "openid profile email model.completion",
                code_challenge: pkce.challenge,
                code_challenge_method: "S256",
              }).toString(),
            })

            if (!deviceResponse.ok) throw new Error("Failed to initiate device authorization")

            const deviceData = (await deviceResponse.json()) as {
              device_code: string
              user_code: string
              verification_uri?: string
              verification_uri_complete?: string
              verification_url?: string
              expires_in?: number
              interval?: number
            }

            // verification_uri_complete embeds the user_code in the URL — user just opens it and logs in
            // If the provider returns a verification_uri but it doesn't include the user_code,
            // append the code as a query parameter so the link opens pre-filled.
            let url =
              deviceData.verification_uri_complete ??
              deviceData.verification_uri ??
              deviceData.verification_url ??
              "https://chat.qwen.ai"

            // If we only have a verification_uri (not the complete one), try to append the
            // user_code as `user_code` query param when it's not already present.
            if (!deviceData.verification_uri_complete && deviceData.verification_uri && deviceData.user_code) {
              try {
                const hasUserCodeParam = url.includes("user_code=") || url.includes("user-code=")
                if (!hasUserCodeParam) {
                  const sep = url.includes("?") ? "&" : "?"
                  url = `${url}${sep}user_code=${encodeURIComponent(deviceData.user_code)}`
                }
              } catch {}
            }

            const interval = (deviceData.interval ?? 5) * 1000
            const hasCompleteUri = Boolean(deviceData.verification_uri_complete)

            return {
              url,
              instructions: hasCompleteUri
                ? "Open the URL in your browser to complete login"
                : `Go to the URL and enter code: ${deviceData.user_code}`,
              method: "auto" as const,
              async callback() {
                while (true) {
                  const response = await fetch(TOKEN_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                      client_id: CLIENT_ID,
                      device_code: deviceData.device_code,
                      code_verifier: pkce.verifier,
                    }).toString(),
                  })

                  if (!response.ok && response.status !== 400) return { type: "failed" as const }

                  const data = (await response.json()) as QwenTokenResponse

                  if (data.access_token) {
                    const expires = data.expiry_date ?? Date.now() + (data.expires_in ?? 3600) * 1000
                    return {
                      type: "success" as const,
                      access: data.access_token,
                      refresh: data.refresh_token ?? data.access_token,
                      expires,
                    }
                  }

                  if (data.error === "authorization_pending" || data.error === "AuthorizationPending") {
                    await Bun.sleep(interval + OAUTH_POLLING_SAFETY_MARGIN_MS)
                    continue
                  }

                  if (data.error === "slow_down" || data.error === "SlowDown") {
                    await Bun.sleep(15_000 + OAUTH_POLLING_SAFETY_MARGIN_MS)
                    continue
                  }

                  if (data.error) return { type: "failed" as const }

                  await Bun.sleep(interval + OAUTH_POLLING_SAFETY_MARGIN_MS)
                }
              },
            }
          },
        },
        {
          type: "api",
          label: "DashScope API key",
        },
      ],
    },
  }
}
