import { $, semver } from "bun"
import path from "path"

const rootPkgPath = path.resolve(import.meta.dir, "../../../package.json")
const rootPkg = await Bun.file(rootPkgPath).json()
const expectedBunVersion = rootPkg.packageManager?.split("@")[1]

if (!expectedBunVersion) {
  throw new Error("packageManager field not found in root package.json")
}

// relax version requirement
const expectedBunVersionRange = `^${expectedBunVersion}`

if (!semver.satisfies(process.versions.bun, expectedBunVersionRange)) {
  throw new Error(`This script requires bun@${expectedBunVersionRange}, but you are using bun@${process.versions.bun}`)
}

const env = {
  GITHUB_REPOSITORY: process.env["GITHUB_REPOSITORY"] || "KSD-CO/IronCode",
  IRONCODE_CHANNEL: process.env["IRONCODE_CHANNEL"],
  IRONCODE_BUMP: process.env["IRONCODE_BUMP"],
  IRONCODE_VERSION: process.env["IRONCODE_VERSION"],
  IRONCODE_RELEASE: process.env["IRONCODE_RELEASE"],
}
const CHANNEL = await (async () => {
  if (env.IRONCODE_CHANNEL) return env.IRONCODE_CHANNEL
  if (env.IRONCODE_BUMP) return "latest"
  if (env.IRONCODE_VERSION && !env.IRONCODE_VERSION.startsWith("0.0.0-")) return "latest"
  return await $`git branch --show-current`.text().then((x) => x.trim())
})()
const IS_PREVIEW = CHANNEL !== "latest"

const VERSION = await (async () => {
  if (env.IRONCODE_VERSION) return env.IRONCODE_VERSION
  if (IS_PREVIEW) return `0.0.0-${CHANNEL}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`
  const version = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/releases?per_page=1`)
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    })
    .then((data: any) => {
      const releases = data as Array<{ tag_name: string; draft: boolean }>
      const latestRelease = releases.find((r) => !r.draft)
      if (!latestRelease) throw new Error("No published releases found")
      return latestRelease.tag_name.replace(/^v/, "")
    })
  const [major, minor, patch] = version.split(".").map((x: string) => Number(x) || 0)
  const t = env.IRONCODE_BUMP?.toLowerCase()
  if (t === "major") return `${major + 1}.0.0`
  if (t === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
})()

const team = [
  "actions-user",
  "ironcode",
  "rekram1-node",
  "thdxr",
  "kommander",
  "jayair",
  "fwang",
  "adamdotdevin",
  "iamdavidhill",
  "ironcode-agent[bot]",
  "R44VC0RP",
]

export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get preview() {
    return IS_PREVIEW
  },
  get release(): boolean {
    return !!env.IRONCODE_RELEASE
  },
  get team() {
    return team
  },
  get repository() {
    return env.GITHUB_REPOSITORY
  },
}
console.log(`ironcode script`, JSON.stringify(Script, null, 2))
