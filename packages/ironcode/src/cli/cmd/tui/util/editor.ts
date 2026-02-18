import { defer } from "@/util/defer"
import { which } from "bun"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { platform } from "node:os"
import { CliRenderer } from "@opentui/core"

export namespace Editor {
  export function resolve(): { cmd: string[]; found: boolean } {
    const editor = process.env["VISUAL"] || process.env["EDITOR"] || "nvim"
    const parts = editor.split(" ")
    return { cmd: parts, found: !!which(parts[0]!) }
  }

  export function installCommand(): { cmd: string[]; hint: string } | null {
    const os = platform()
    if (os === "darwin") {
      if (which("brew")) return { cmd: ["brew", "install", "neovim"], hint: "brew install neovim" }
      return null
    }
    if (os === "linux") {
      if (which("apt-get")) return { cmd: ["sudo", "apt-get", "install", "-y", "neovim"], hint: "sudo apt-get install -y neovim" }
      if (which("dnf")) return { cmd: ["sudo", "dnf", "install", "-y", "neovim"], hint: "sudo dnf install -y neovim" }
      if (which("pacman")) return { cmd: ["sudo", "pacman", "-S", "--noconfirm", "neovim"], hint: "sudo pacman -S neovim" }
      if (which("apk")) return { cmd: ["sudo", "apk", "add", "neovim"], hint: "sudo apk add neovim" }
      return null
    }
    if (os === "win32") {
      if (which("winget")) return { cmd: ["winget", "install", "Neovim.Neovim"], hint: "winget install Neovim.Neovim" }
      if (which("choco")) return { cmd: ["choco", "install", "neovim", "-y"], hint: "choco install neovim -y" }
      if (which("scoop")) return { cmd: ["scoop", "install", "neovim"], hint: "scoop install neovim" }
      return null
    }
    return null
  }

  export async function install(renderer: CliRenderer): Promise<boolean> {
    const info = installCommand()
    if (!info) return false

    try {
      renderer.suspend()
      renderer.currentRenderBuffer.clear()
      const proc = Bun.spawn({
        cmd: info.cmd,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      })
      await proc.exited
    } catch {
      // spawn or process failed
    } finally {
      renderer.currentRenderBuffer.clear()
      renderer.resume()
      renderer.requestRender()
    }

    return resolve().found
  }

  export async function open(opts: { value: string; renderer: CliRenderer }): Promise<string | undefined> {
    const { cmd: parts, found } = resolve()
    if (!found) return

    const filepath = join(tmpdir(), `${Date.now()}.md`)
    await using _ = defer(async () => rm(filepath, { force: true }))

    await Bun.write(filepath, opts.value)
    opts.renderer.suspend()
    opts.renderer.currentRenderBuffer.clear()
    const proc = Bun.spawn({
      cmd: [...parts, filepath],
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    })
    await proc.exited
    const content = await Bun.file(filepath).text()
    opts.renderer.currentRenderBuffer.clear()
    opts.renderer.resume()
    opts.renderer.requestRender()
    return content || undefined
  }
}
