#!/usr/bin/env bun
import { $ } from "bun"

await $`bun run typecheck`
await $`npm publish --access public`
