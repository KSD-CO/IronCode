export * from "./client.js"
export * from "./server.js"

import { createIroncodeClient } from "./client.js"
import { createIroncodeServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export async function createIroncode(options?: ServerOptions) {
  const server = await createIroncodeServer({
    ...options,
  })

  const client = createIroncodeClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
