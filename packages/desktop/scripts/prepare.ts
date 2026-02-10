#!/usr/bin/env bun
import { $ } from "bun"

import { Script } from "@ironcode-ai/script"
import { copyBinaryToSidecarFolder, getCurrentSidecar, windowsify } from "./utils"

const pkg = await Bun.file("./package.json").json()
pkg.version = Script.version
await Bun.write("./package.json", JSON.stringify(pkg, null, 2) + "\n")
console.log(`Updated package.json version to ${Script.version}`)

const sidecarConfig = getCurrentSidecar()

const dir = "src-tauri/target/ironcode-binaries"

// Determine platform for artifact name
const platform = process.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : "linux"
const artifactName = `ironcode-cli-${platform}`

await $`mkdir -p ${dir}`
await $`gh run download ${Bun.env.GITHUB_RUN_ID} -n ${artifactName}`.cwd(dir)

await copyBinaryToSidecarFolder(windowsify(`${dir}/${sidecarConfig.ocBinary}/bin/ironcode`))
