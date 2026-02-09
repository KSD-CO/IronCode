export const deepLinkEvent = "ironcode:deep-link"

export const parseDeepLink = (input: string) => {
  if (!input.startsWith("ironcode://")) return
  const url = new URL(input)
  if (url.hostname !== "open-project") return
  const directory = url.searchParams.get("directory")
  if (!directory) return
  return directory
}

export const collectOpenProjectDeepLinks = (urls: string[]) =>
  urls.map(parseDeepLink).filter((directory): directory is string => !!directory)

type IronCodeWindow = Window & {
  __IRONCODE__?: {
    deepLinks?: string[]
  }
}

export const drainPendingDeepLinks = (target: IronCodeWindow) => {
  const pending = target.__IRONCODE__?.deepLinks ?? []
  if (pending.length === 0) return []
  if (target.__IRONCODE__) target.__IRONCODE__.deepLinks = []
  return pending
}
