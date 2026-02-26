#!/usr/bin/env bun
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@ironcode-ai/script"
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const binaries: Record<string, string> = {}
for (const filepath of new Bun.Glob("*/package.json").scanSync({ cwd: "./dist" })) {
  const pkg = await Bun.file(`./dist/${filepath}`).json()
  binaries[pkg.name] = pkg.version
}
console.log("binaries", binaries)
const version = Object.values(binaries)[0]

await $`mkdir -p ./dist/${pkg.name}`
await $`cp -r ./bin ./dist/${pkg.name}/bin`
await $`cp ./script/postinstall.mjs ./dist/${pkg.name}/postinstall.mjs`
await Bun.file(`./dist/${pkg.name}/LICENSE`).write(await Bun.file("../../LICENSE").text())
await Bun.file(`./dist/${pkg.name}/README.md`).write(await Bun.file("../../README.md").text())

await Bun.file(`./dist/${pkg.name}/package.json`).write(
  JSON.stringify(
    {
      name: pkg.name + "-ai",
      bin: {
        [pkg.name]: `./bin/${pkg.name}`,
      },
      scripts: {
        postinstall: "bun ./postinstall.mjs || node ./postinstall.mjs",
      },
      version: version,
      license: pkg.license,
      optionalDependencies: binaries,
    },
    null,
    2,
  ),
)

const tasks = Object.entries(binaries).map(async ([name]) => {
  if (process.platform !== "win32") {
    await $`chmod -R 755 .`.cwd(`./dist/${name}`)
  }
  await $`bun pm pack`.cwd(`./dist/${name}`)

  // Skip npm publish if no token configured
  if (!process.env.NPM_TOKEN && !process.env.NODE_AUTH_TOKEN) {
    console.log(`Skipping npm publish for ${name} (no NPM_TOKEN configured)`)
    return
  }

  await $`npm publish *.tgz --access public --tag ${Script.channel}`.cwd(`./dist/${name}`)
})
await Promise.all(tasks)

// Skip main package publish if no token
if (!process.env.NPM_TOKEN && !process.env.NODE_AUTH_TOKEN) {
  console.log("Skipping main package npm publish (no NPM_TOKEN configured)")
} else {
  await $`cd ./dist/${pkg.name} && bun pm pack && npm publish *.tgz --access public --tag ${Script.channel}`
}

// registries
if (!Script.preview) {
  // Download archives from GitHub Release to calculate SHA values
  console.log("Downloading release archives for SHA calculation...")
  const archiveFiles = [
    "ironcode-linux-arm64.tar.gz",
    "ironcode-linux-x64.tar.gz",
    "ironcode-darwin-x64.zip",
    "ironcode-darwin-arm64.zip",
  ]

  for (const file of archiveFiles) {
    try {
      await $`gh release download v${Script.version} -p ${file} -D ./dist --clobber`
    } catch (e) {
      console.warn(`Warning: Could not download ${file}, it may not exist yet`)
    }
  }

  // Calculate SHA values
  const arm64Sha = await $`sha256sum ./dist/ironcode-linux-arm64.tar.gz | cut -d' ' -f1`.text().then((x) => x.trim())
  const x64Sha = await $`sha256sum ./dist/ironcode-linux-x64.tar.gz | cut -d' ' -f1`.text().then((x) => x.trim())
  const macX64Sha = await $`sha256sum ./dist/ironcode-darwin-x64.zip | cut -d' ' -f1`.text().then((x) => x.trim())
  const macArm64Sha = await $`sha256sum ./dist/ironcode-darwin-arm64.zip | cut -d' ' -f1`.text().then((x) => x.trim())

  const [pkgver, _subver = ""] = Script.version.split(/(-.*)/, 2)

  // arch
  const binaryPkgbuild = [
    "# Maintainer: dax",
    "# Maintainer: adam",
    "",
    "pkgname='ironcode-bin'",
    `pkgver=${pkgver}`,
    `_subver=${_subver}`,
    "options=('!debug' '!strip')",
    "pkgrel=1",
    "pkgdesc='The AI coding agent built for the terminal.'",
    "url='https://github.com/${Script.repository}'",
    "arch=('aarch64' 'x86_64')",
    "license=('MIT')",
    "provides=('ironcode')",
    "conflicts=('ironcode')",
    "depends=('ripgrep')",
    "",
    `source_aarch64=("\${pkgname}_\${pkgver}_aarch64.tar.gz::https://github.com/${Script.repository}/releases/download/v\${pkgver}\${_subver}/ironcode-linux-arm64.tar.gz")`,
    `sha256sums_aarch64=('${arm64Sha}')`,

    `source_x86_64=("\${pkgname}_\${pkgver}_x86_64.tar.gz::https://github.com/${Script.repository}/releases/download/v\${pkgver}\${_subver}/ironcode-linux-x64.tar.gz")`,
    `sha256sums_x86_64=('${x64Sha}')`,
    "",
    "package() {",
    '  install -Dm755 ./ironcode "${pkgdir}/usr/bin/ironcode"',
    "}",
    "",
  ].join("\n")

  // AUR publishing - skip if AUR_KEY is not set or SKIP_AUR is true
  const skipAUR = process.env.SKIP_AUR === "true" || !process.env.AUR_KEY
  if (!skipAUR) {
    console.log("Publishing to AUR...")
    for (const [pkg, pkgbuild] of [["ironcode-bin", binaryPkgbuild]]) {
      for (let i = 0; i < 30; i++) {
        try {
          await $`rm -rf ./dist/aur-${pkg}`
          await $`git clone ssh://aur@aur.archlinux.org/${pkg}.git ./dist/aur-${pkg}`
          await $`cd ./dist/aur-${pkg} && git checkout master`
          await Bun.file(`./dist/aur-${pkg}/PKGBUILD`).write(pkgbuild)
          await $`cd ./dist/aur-${pkg} && makepkg --printsrcinfo > .SRCINFO`
          await $`cd ./dist/aur-${pkg} && git add PKGBUILD .SRCINFO`
          await $`cd ./dist/aur-${pkg} && git commit -m "Update to v${Script.version}"`
          await $`cd ./dist/aur-${pkg} && git push`
          break
        } catch (e) {
          continue
        }
      }
    }
  } else {
    console.log("Skipping AUR publishing (SKIP_AUR=true or AUR_KEY not set)")
  }

  // Homebrew formula
  const homebrewFormula = [
    "# typed: false",
    "# frozen_string_literal: true",
    "",
    "# This file was generated by GoReleaser. DO NOT EDIT.",
    "class Ironcode < Formula",
    `  desc "The AI coding agent built for the terminal."`,
    `  homepage "https://github.com/${Script.repository}"`,
    `  version "${Script.version.split("-")[0]}"`,
    "",
    `  depends_on "ripgrep"`,
    "",
    "  on_macos do",
    "    if Hardware::CPU.intel?",
    `      url "https://github.com/${Script.repository}/releases/download/v${Script.version}/ironcode-darwin-x64.zip"`,
    `      sha256 "${macX64Sha}"`,
    "",
    "      def install",
    '        bin.install "ironcode"',
    "      end",
    "    end",
    "    if Hardware::CPU.arm?",
    `      url "https://github.com/${Script.repository}/releases/download/v${Script.version}/ironcode-darwin-arm64.zip"`,
    `      sha256 "${macArm64Sha}"`,
    "",
    "      def install",
    '        bin.install "ironcode"',
    "      end",
    "    end",
    "  end",
    "",
    "  on_linux do",
    "    if Hardware::CPU.intel? and Hardware::CPU.is_64_bit?",
    `      url "https://github.com/${Script.repository}/releases/download/v${Script.version}/ironcode-linux-x64.tar.gz"`,
    `      sha256 "${x64Sha}"`,
    "      def install",
    '        bin.install "ironcode"',
    "      end",
    "    end",
    "    if Hardware::CPU.arm? and Hardware::CPU.is_64_bit?",
    `      url "https://github.com/${Script.repository}/releases/download/v${Script.version}/ironcode-linux-arm64.tar.gz"`,
    `      sha256 "${arm64Sha}"`,
    "      def install",
    '        bin.install "ironcode"',
    "      end",
    "    end",
    "  end",
    "end",
    "",
    "",
  ].join("\n")

  // Use HOMEBREW_TAP_TOKEN if available, otherwise fall back to GITHUB_TOKEN
  const token = process.env.HOMEBREW_TAP_TOKEN || process.env.GITHUB_TOKEN

  // Skip Homebrew tap publishing if SKIP_HOMEBREW is set
  const skipHomebrew = process.env.SKIP_HOMEBREW === "true"

  if (skipHomebrew) {
    console.log("Skipping Homebrew tap publishing (SKIP_HOMEBREW=true)")
  } else if (!token) {
    console.error("HOMEBREW_TAP_TOKEN or GITHUB_TOKEN is required to update homebrew tap")
    console.error("Set SKIP_HOMEBREW=true to skip Homebrew publishing")
    process.exit(1)
  } else {
    try {
      const tap = `https://x-access-token:${token}@github.com/KSD-CO/homebrew-tap.git`
      await $`rm -rf ./dist/homebrew-tap`
      await $`git clone ${tap} ./dist/homebrew-tap`
      await Bun.file("./dist/homebrew-tap/ironcode.rb").write(homebrewFormula)
      await $`cd ./dist/homebrew-tap && git add ironcode.rb`
      await $`cd ./dist/homebrew-tap && git commit -m "Update to v${Script.version}"`
      await $`cd ./dist/homebrew-tap && git push`
      console.log("Successfully published to Homebrew tap")
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error("Failed to publish to Homebrew tap:", message)
      console.error("You may need to set HOMEBREW_TAP_TOKEN with proper permissions")
      // Don't fail the entire publish if Homebrew tap fails
    }
  }
}
