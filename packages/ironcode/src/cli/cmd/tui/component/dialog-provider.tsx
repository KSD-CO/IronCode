import { createMemo, createSignal, onMount, Show } from "solid-js"
import { useSync } from "@tui/context/sync"
import { filter, map, pipe } from "remeda"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useSDK } from "../context/sdk"
import { DialogPrompt } from "../ui/dialog-prompt"
import { Link } from "../ui/link"
import { useTheme } from "../context/theme"
import { TextAttributes } from "@opentui/core"
import type { ProviderAuthAuthorization } from "@ironcode-ai/sdk/v2"
import { DialogModel } from "./dialog-model"
import { useKeyboard } from "@opentui/solid"
import { Clipboard } from "@tui/util/clipboard"
import { useToast } from "../ui/toast"

const PROVIDER_PRIORITY: Record<string, number> = {
  ironcode: 0,
  anthropic: 1,
  "github-copilot": 2,
  openai: 3,
  google: 4,
  alibaba: 5,
}

export function createDialogProviderOptions() {
  const sync = useSync()
  const dialog = useDialog()
  const sdk = useSDK()
  const connected = createMemo(() => new Set(sync.data.provider_next.connected))

  // Group connected accounts by base provider ID.
  // A group is "multi-account" when it contains at least one numbered variant (e.g. "anthropic-2").
  const accountGroups = createMemo(() => {
    const groups: Record<string, string[]> = {}
    for (const id of sync.data.provider_next.connected) {
      const baseID = id.replace(/-\d+$/, "")
      if (!groups[baseID]) groups[baseID] = []
      groups[baseID].push(id)
    }
    return Object.fromEntries(
      Object.entries(groups).filter(([baseID, ids]) => ids.some((id) => id !== baseID)),
    )
  })

  async function startOAuthFlow(targetProviderID: string, baseProviderID: string) {
    const methods = sync.data.provider_auth[baseProviderID] ?? [{ type: "api" as const, label: "API key" }]
    let index: number | null = 0
    if (methods.length > 1) {
      index = await new Promise<number | null>((resolve) => {
        dialog.replace(
          () => (
            <DialogSelect
              title="Select auth method"
              options={methods.map((x, i) => ({ title: x.label, value: i }))}
              onSelect={(option) => resolve(option.value)}
            />
          ),
          () => resolve(null),
        )
      })
    }
    if (index == null) return
    const method = methods[index]
    if (method.type === "oauth") {
      const result = await sdk.client.provider.oauth.authorize({ providerID: targetProviderID, method: index })
      if (result.data?.method === "code") {
        dialog.replace(() => (
          <CodeMethod providerID={targetProviderID} title={method.label} index={index!} authorization={result.data!} />
        ))
      }
      if (result.data?.method === "auto") {
        dialog.replace(() => (
          <AutoMethod providerID={targetProviderID} title={method.label} index={index!} authorization={result.data!} />
        ))
      }
    }
    if (method.type === "api") {
      dialog.replace(() => <ApiMethod providerID={targetProviderID} title={method.label} />)
    }
  }

  const options = createMemo(() => {
    const allProviders = sync.data.provider_next.all
    const groups = accountGroups()

    // Collect all account IDs that are rendered as individual rows inside a multi-account group
    const groupedIDs = new Set<string>(Object.values(groups).flat())

    type Entry = {
      _priority: number
      title: string
      value: string
      category: string
      description?: string
      footer?: string
      onSelect: () => Promise<void>
    }

    // Per-account rows + "Add account" row for every multi-account group
    const multiAccountEntries: Entry[] = []
    for (const [baseID, accountIDs] of Object.entries(groups)) {
      const priority = PROVIDER_PRIORITY[baseID] ?? 99
      accountIDs.forEach((accountID, i) => {
        const provider = allProviders.find((p) => p.id === accountID)
        if (!provider) return
        multiAccountEntries.push({
          _priority: priority + i * 0.01,
          title: provider.name,
          value: provider.id,
          category: "Connected",
          footer: "Connected",
          async onSelect() {
            await startOAuthFlow(accountID, baseID)
          },
        })
      })
      // "Add account" row always appears after all connected accounts
      const nums = accountIDs
        .map((id) => (id === baseID ? 1 : parseInt(id.slice(baseID.length + 1), 10)))
        .sort((a, b) => b - a)
      const nextID = `${baseID}-${(nums[0] ?? 0) + 1}`
      const baseName = allProviders.find((p) => p.id === baseID)?.name ?? baseID
      multiAccountEntries.push({
        _priority: priority + accountIDs.length * 0.01,
        title: `${baseName} · Add account`,
        value: nextID,
        category: "Connected",
        async onSelect() {
          await startOAuthFlow(nextID, baseID)
        },
      })
    }

    // Single-row entries for all providers not already shown as grouped accounts.
    // Also exclude standalone numbered variants — they only appear inside multi-account groups.
    const regularEntries = pipe(
      allProviders,
      filter((x) => {
        if (groupedIDs.has(x.id)) return false
        // Exclude numbered variants (e.g. "anthropic-2") — they should only appear in groups
        if (/-\d+$/.test(x.id)) return false
        return true
      }),
      map((provider) => {
        const isConnected = connected().has(provider.id)
        return {
          _priority: isConnected ? (PROVIDER_PRIORITY[provider.id] ?? 99) : (PROVIDER_PRIORITY[provider.id] ?? 99) + 1000,
          title: provider.name,
          value: provider.id,
          description: isConnected
            ? undefined
            : ({
                ironcode: "(Recommended)",
                anthropic: "(Claude Max or API key)",
                openai: "(ChatGPT Plus/Pro or API key)",
                alibaba: "(Qwen models — DashScope API key)",
              } as Record<string, string>)[provider.id],
          category: isConnected ? "Connected" : "Add provider",
          footer: isConnected ? ("Connected" as const) : undefined,
          async onSelect() {
            let targetID = provider.id
            if (isConnected) {
              // Already connected — offer add vs replace before opening auth flow
              const action = await new Promise<"add" | "replace" | null>((resolve) => {
                dialog.replace(
                  () => (
                    <DialogSelect
                      title={provider.name}
                      options={[
                        { title: "Add another account", value: "add" as const },
                        { title: "Replace existing account", value: "replace" as const },
                      ]}
                      onSelect={(opt) => resolve(opt.value)}
                    />
                  ),
                  () => resolve(null),
                )
              })
              if (action == null) return
              if (action === "add") {
                const existingIDs = sync.data.provider_next.connected.filter(
                  (id) =>
                    id === provider.id ||
                    (id.startsWith(`${provider.id}-`) && /^\d+$/.test(id.slice(provider.id.length + 1))),
                )
                const nums = existingIDs
                  .map((id) => (id === provider.id ? 1 : parseInt(id.slice(provider.id.length + 1), 10)))
                  .sort((a, b) => b - a)
                targetID = `${provider.id}-${(nums[0] ?? 0) + 1}`
              }
            }
            await startOAuthFlow(targetID, provider.id)
          },
        }
      }),
    )

    return [...regularEntries, ...multiAccountEntries].sort((a, b) => a._priority - b._priority)
  })

  return options
}

export function DialogProvider() {
  const options = createDialogProviderOptions()
  return <DialogSelect title="Connect a provider" options={options()} />
}

interface AutoMethodProps {
  index: number
  providerID: string
  title: string
  authorization: ProviderAuthAuthorization
}
function AutoMethod(props: AutoMethodProps) {
  const { theme } = useTheme()
  const sdk = useSDK()
  const dialog = useDialog()
  const sync = useSync()
  const toast = useToast()
  const [hover, setHover] = createSignal(false)

  useKeyboard((evt) => {
    if (evt.name === "c" && !evt.ctrl && !evt.meta) {
      const code = props.authorization.instructions.match(/[A-Z0-9]{4}-[A-Z0-9]{4,5}/)?.[0] ?? props.authorization.url
      Clipboard.copy(code)
        .then(() => toast.show({ message: "Copied to clipboard", variant: "info" }))
        .catch(toast.error)
    }
  })

  onMount(async () => {
    const result = await sdk.client.provider.oauth.callback({
      providerID: props.providerID,
      method: props.index,
    })
    if (result.error) {
      dialog.clear()
      return
    }
    await sdk.client.instance.dispose()
    await sync.bootstrap()
    dialog.replace(() => <DialogModel providerID={props.providerID} />)
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {props.title}
        </text>
        <box
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={hover() ? theme.primary : undefined}
          onMouseOver={() => setHover(true)}
          onMouseOut={() => setHover(false)}
          onMouseUp={() => dialog.clear()}
        >
          <text fg={hover() ? theme.selectedListItemText : theme.textMuted}>esc</text>
        </box>
      </box>
      <box gap={1}>
        <Link href={props.authorization.url} fg={theme.primary} />
        <text fg={theme.textMuted}>{props.authorization.instructions}</text>
      </box>
      <text fg={theme.textMuted}>Waiting for authorization...</text>
      <text fg={theme.text}>
        c <span style={{ fg: theme.textMuted }}>copy</span>
      </text>
    </box>
  )
}

interface CodeMethodProps {
  index: number
  title: string
  providerID: string
  authorization: ProviderAuthAuthorization
}
function CodeMethod(props: CodeMethodProps) {
  const { theme } = useTheme()
  const sdk = useSDK()
  const sync = useSync()
  const dialog = useDialog()
  const [error, setError] = createSignal(false)

  return (
    <DialogPrompt
      title={props.title}
      placeholder="Authorization code"
      onConfirm={async (value) => {
        const { error } = await sdk.client.provider.oauth.callback({
          providerID: props.providerID,
          method: props.index,
          code: value,
        })
        if (!error) {
          await sdk.client.instance.dispose()
          await sync.bootstrap()
          dialog.replace(() => <DialogModel providerID={props.providerID} />)
          return
        }
        setError(true)
      }}
      description={() => (
        <box gap={1}>
          <text fg={theme.textMuted}>{props.authorization.instructions}</text>
          <Link href={props.authorization.url} fg={theme.primary} />
          <Show when={error()}>
            <text fg={theme.error}>Invalid code</text>
          </Show>
        </box>
      )}
    />
  )
}

interface ApiMethodProps {
  providerID: string
  title: string
}
function ApiMethod(props: ApiMethodProps) {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const { theme } = useTheme()

  return (
    <DialogPrompt
      title={props.title}
      placeholder="API key"
      description={
        props.providerID === "ironcode" ? (
          <box gap={1}>
            <text fg={theme.textMuted}>
              IronCode Zen gives you access to all the best coding models at the cheapest prices with a single API key.
            </text>
            <text fg={theme.text}>
              Go to <span style={{ fg: theme.primary }}>https://ironcode.cloud/zen</span> to get a key
            </text>
          </box>
        ) : props.providerID === "alibaba" || props.providerID?.startsWith("alibaba-") ? (
          <box gap={1}>
            <text fg={theme.textMuted}>Qwen models via Alibaba DashScope.</text>
            <text fg={theme.text}>
              Get a key at <span style={{ fg: theme.primary }}>https://dashscope-intl.aliyun.com</span>
            </text>
          </box>
        ) : undefined
      }
      onConfirm={async (value) => {
        if (!value) return
        await sdk.client.auth.set({
          providerID: props.providerID,
          auth: {
            type: "api",
            key: value,
          },
        })
        await sdk.client.instance.dispose()
        await sync.bootstrap()
        dialog.replace(() => <DialogModel providerID={props.providerID} />)
      }}
    />
  )
}
