import { Bus } from "../bus"
import { Installation } from "../installation"
import { Session } from "../session"
import { MessageV2 } from "../session/message-v2"
import { Log } from "../util/log"

export namespace Share {
  // DISABLED: Share feature disabled due to security concerns
  // - No authentication required to create shares
  // - No rate limiting (cost attack vector)
  // - No size limits on uploads
  // - Predictable 8-char IDs (brute force risk)
  // - Anyone can view shared sessions if they know the ID

  const log = Log.create({ service: "share" })

  let queue: Promise<void> = Promise.resolve()
  const pending = new Map<string, any>()

  export async function sync(key: string, content: any) {
    // DISABLED: Always return early
    return

    // if (disabled) return
    // const [root, ...splits] = key.split("/")
    // if (root !== "session") return
    // const [sub, sessionID] = splits
    // if (sub === "share") return
    // const share = await Session.getShare(sessionID).catch(() => {})
    // if (!share) return
    // const { secret } = share
    // pending.set(key, content)
    // queue = queue
    //   .then(async () => {
    //     const content = pending.get(key)
    //     if (content === undefined) return
    //     pending.delete(key)

    //     return fetch(`${URL}/share_sync`, {
    //       method: "POST",
    //       body: JSON.stringify({
    //         sessionID: sessionID,
    //         secret,
    //         key: key,
    //         content,
    //       }),
    //     })
    //   })
    //   .then((x) => {
    //     if (x) {
    //       log.info("synced", {
    //         key: key,
    //         status: x.status,
    //       })
    //     }
    //   })
  }

  export function init() {
    // DISABLED: Don't subscribe to events
    return

    // Bus.subscribe(Session.Event.Updated, async (evt) => {
    //   await sync("session/info/" + evt.properties.info.id, evt.properties.info)
    // })
    // Bus.subscribe(MessageV2.Event.Updated, async (evt) => {
    //   await sync("session/message/" + evt.properties.info.sessionID + "/" + evt.properties.info.id, evt.properties.info)
    // })
    // Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
    //   await sync(
    //     "session/part/" +
    //       evt.properties.part.sessionID +
    //       "/" +
    //       evt.properties.part.messageID +
    //       "/" +
    //       evt.properties.part.id,
    //     evt.properties.part,
    //   )
    // })
  }

  export const URL =
    process.env["IRONCODE_API"] ??
    (Installation.isPreview() || Installation.isLocal()
      ? "https://api.dev.ironcode.cloud"
      : "https://api.ironcode.cloud")

  const disabled = true // DISABLED: Force disable share feature

  export async function create(sessionID: string) {
    // DISABLED: Always return empty
    return { url: "", secret: "" }

    // if (disabled) return { url: "", secret: "" }
    // return fetch(`${URL}/share_create`, {
    //   method: "POST",
    //   body: JSON.stringify({ sessionID: sessionID }),
    // })
    //   .then((x) => x.json())
    //   .then((x) => x as { url: string; secret: string })
  }

  export async function remove(sessionID: string, secret: string) {
    // DISABLED: Always return empty
    return {}

    // if (disabled) return {}
    // return fetch(`${URL}/share_delete`, {
    //   method: "POST",
    //   body: JSON.stringify({ sessionID, secret }),
    // }).then((x) => x.json())
  }
}
