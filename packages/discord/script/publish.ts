#!/usr/bin/env bun
import { Script } from "@ironcode-ai/script"
import { $ } from "bun"

const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)

await $`bun pm pack && npm publish *.tgz --tag ${Script.channel} --access public`
