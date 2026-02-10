#!/usr/bin/env bun

import { Script } from "@ironcode-ai/script"
import { $ } from "bun"
import { buildNotes, getLatestRelease } from "./changelog"

const output = [`version=${Script.version}`]

if (!Script.preview) {
  try {
    const previous = await getLatestRelease()
    const notes = await buildNotes(previous, "HEAD")
    const body = notes.join("\n") || "No notable changes"
    const dir = process.env.RUNNER_TEMP ?? "/tmp"
    const file = `${dir}/ironcode-release-notes.txt`
    await Bun.write(file, body)
    await $`gh release create v${Script.version} -d --title "v${Script.version}" --notes-file ${file}`
  } catch (error) {
    // No previous releases found, create first release without changelog
    console.log("No previous releases found, creating first release")
    const body = "Initial release"
    const dir = process.env.RUNNER_TEMP ?? "/tmp"
    const file = `${dir}/ironcode-release-notes.txt`
    await Bun.write(file, body)
    await $`gh release create v${Script.version} -d --title "v${Script.version}" --notes-file ${file}`
  }

  // Get release info from the list since draft releases may not be accessible by tag immediately
  // Add retry logic as the release may take a moment to appear in the API
  let releases: { id: number; tag_name: string } | null = null
  for (let i = 0; i < 5; i++) {
    try {
      const jqQuery = `.[] | select(.tag_name == "v${Script.version}") | {id, tag_name}`
      releases = await $`gh api repos/${Script.repository}/releases --jq ${jqQuery}`.json()
      break
    } catch (error) {
      if (i === 4) throw error
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  if (!releases) {
    throw new Error(`Failed to find release v${Script.version}`)
  }

  output.push(`release=${releases.id}`)
  output.push(`tag=${releases.tag_name}`)
}

if (process.env.GITHUB_OUTPUT) {
  await Bun.write(process.env.GITHUB_OUTPUT, output.join("\n"))
}

process.exit(0)
