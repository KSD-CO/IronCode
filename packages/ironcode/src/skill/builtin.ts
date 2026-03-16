import path from "path"
import fs from "fs/promises"
import { builtinSkills } from "./builtin-skills-snapshot"
import { Global } from "@/global"
import { Log } from "../util/log"
import { Installation } from "@/installation"

const log = Log.create({ service: "builtin-skills" })

// Marker file to distinguish auto-installed skills from user-customized ones.
// If this file exists, the skill was installed by IronCode and is safe to upgrade.
// If a user deletes the marker or creates the skill dir manually, we won't overwrite.
const BUILTIN_MARKER = ".builtin"

export async function extractBuiltinSkills() {
  if (builtinSkills.length === 0) return

  const targetDir = path.join(Global.Path.home, ".ironcode", "skill")
  await fs.mkdir(targetDir, { recursive: true })

  let installed = 0
  let upgraded = 0
  let skipped = 0

  await Promise.all(
    builtinSkills.map(async (skill) => {
      const dest = path.join(targetDir, skill.name)
      const markerPath = path.join(dest, BUILTIN_MARKER)
      const skillPath = path.join(dest, "SKILL.md")

      const dirExists = await fs
        .stat(dest)
        .then((s) => s.isDirectory())
        .catch(() => false)
      const markerExists = dirExists && (await Bun.file(markerPath).exists())

      // Skip if user has a custom (non-builtin) version
      if (dirExists && !markerExists) {
        skipped++
        return
      }

      // Check if content has changed (avoid unnecessary writes)
      if (markerExists) {
        const existing = await Bun.file(skillPath)
          .text()
          .catch(() => "")
        if (existing === skill.content) {
          return // Already up to date
        }
        upgraded++
      } else {
        installed++
      }

      await fs.mkdir(dest, { recursive: true })
      await Bun.write(skillPath, skill.content)
      await Bun.write(markerPath, `installed by ironcode v${Installation.VERSION}\n`)
    }),
  )

  if (installed > 0) {
    log.info("installed builtin skills", { count: installed })
  }
  if (upgraded > 0) {
    log.info("upgraded builtin skills", { count: upgraded })
  }
  if (skipped > 0) {
    log.debug("skipped user-customized skills", { count: skipped })
  }
}
