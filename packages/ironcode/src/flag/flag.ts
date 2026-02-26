function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

export namespace Flag {
  export const IRONCODE_AUTO_SHARE = truthy("IRONCODE_AUTO_SHARE")
  export const IRONCODE_GIT_BASH_PATH = process.env["IRONCODE_GIT_BASH_PATH"]
  export const IRONCODE_CONFIG = process.env["IRONCODE_CONFIG"]
  export declare const IRONCODE_CONFIG_DIR: string | undefined
  export const IRONCODE_CONFIG_CONTENT = process.env["IRONCODE_CONFIG_CONTENT"]
  export const IRONCODE_DISABLE_AUTOUPDATE = truthy("IRONCODE_DISABLE_AUTOUPDATE")
  export const IRONCODE_DISABLE_PRUNE = truthy("IRONCODE_DISABLE_PRUNE")
  export const IRONCODE_DISABLE_TERMINAL_TITLE = truthy("IRONCODE_DISABLE_TERMINAL_TITLE")
  export const IRONCODE_PERMISSION = process.env["IRONCODE_PERMISSION"]
  export const IRONCODE_DISABLE_DEFAULT_PLUGINS = truthy("IRONCODE_DISABLE_DEFAULT_PLUGINS")
  export const IRONCODE_DISABLE_LSP_DOWNLOAD = truthy("IRONCODE_DISABLE_LSP_DOWNLOAD")
  export const IRONCODE_ENABLE_EXPERIMENTAL_MODELS = truthy("IRONCODE_ENABLE_EXPERIMENTAL_MODELS")
  export const IRONCODE_DISABLE_AUTOCOMPACT = truthy("IRONCODE_DISABLE_AUTOCOMPACT")
  export const IRONCODE_DISABLE_MODELS_FETCH = truthy("IRONCODE_DISABLE_MODELS_FETCH")
  export const IRONCODE_DISABLE_CLAUDE_CODE = truthy("IRONCODE_DISABLE_CLAUDE_CODE")
  export const IRONCODE_DISABLE_CLAUDE_CODE_PROMPT =
    IRONCODE_DISABLE_CLAUDE_CODE || truthy("IRONCODE_DISABLE_CLAUDE_CODE_PROMPT")
  export const IRONCODE_DISABLE_CLAUDE_CODE_SKILLS =
    IRONCODE_DISABLE_CLAUDE_CODE || truthy("IRONCODE_DISABLE_CLAUDE_CODE_SKILLS")
  export const IRONCODE_DISABLE_EXTERNAL_SKILLS =
    IRONCODE_DISABLE_CLAUDE_CODE_SKILLS || truthy("IRONCODE_DISABLE_EXTERNAL_SKILLS")
  export declare const IRONCODE_DISABLE_PROJECT_CONFIG: boolean
  export const IRONCODE_FAKE_VCS = process.env["IRONCODE_FAKE_VCS"]
  export declare const IRONCODE_CLIENT: string
  export const IRONCODE_SERVER_PASSWORD = process.env["IRONCODE_SERVER_PASSWORD"]
  export const IRONCODE_SERVER_USERNAME = process.env["IRONCODE_SERVER_USERNAME"]

  // Experimental
  export const IRONCODE_EXPERIMENTAL = truthy("IRONCODE_EXPERIMENTAL")
  export const IRONCODE_EXPERIMENTAL_FILEWATCHER = truthy("IRONCODE_EXPERIMENTAL_FILEWATCHER")
  export const IRONCODE_EXPERIMENTAL_DISABLE_FILEWATCHER = truthy("IRONCODE_EXPERIMENTAL_DISABLE_FILEWATCHER")
  export const IRONCODE_EXPERIMENTAL_ICON_DISCOVERY =
    IRONCODE_EXPERIMENTAL || truthy("IRONCODE_EXPERIMENTAL_ICON_DISCOVERY")
  export const IRONCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT = truthy("IRONCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const IRONCODE_ENABLE_EXA =
    truthy("IRONCODE_ENABLE_EXA") || IRONCODE_EXPERIMENTAL || truthy("IRONCODE_EXPERIMENTAL_EXA")
  export const IRONCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = number("IRONCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS")
  export const IRONCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX = number("IRONCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  export const IRONCODE_EXPERIMENTAL_OXFMT = IRONCODE_EXPERIMENTAL || truthy("IRONCODE_EXPERIMENTAL_OXFMT")
  export const IRONCODE_EXPERIMENTAL_LSP_TY = truthy("IRONCODE_EXPERIMENTAL_LSP_TY")
  export const IRONCODE_EXPERIMENTAL_LSP_TOOL = IRONCODE_EXPERIMENTAL || truthy("IRONCODE_EXPERIMENTAL_LSP_TOOL")
  export const IRONCODE_DISABLE_FILETIME_CHECK = truthy("IRONCODE_DISABLE_FILETIME_CHECK")
  export const IRONCODE_EXPERIMENTAL_PLAN_MODE = IRONCODE_EXPERIMENTAL || truthy("IRONCODE_EXPERIMENTAL_PLAN_MODE")
  export const IRONCODE_EXPERIMENTAL_MARKDOWN = truthy("IRONCODE_EXPERIMENTAL_MARKDOWN")
  export const IRONCODE_MODELS_URL = process.env["IRONCODE_MODELS_URL"]
  export const IRONCODE_MODELS_PATH = process.env["IRONCODE_MODELS_PATH"]

  function number(key: string) {
    const value = process.env[key]
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
}

// Dynamic getter for IRONCODE_DISABLE_PROJECT_CONFIG
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "IRONCODE_DISABLE_PROJECT_CONFIG", {
  get() {
    return truthy("IRONCODE_DISABLE_PROJECT_CONFIG")
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for IRONCODE_CONFIG_DIR
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "IRONCODE_CONFIG_DIR", {
  get() {
    return process.env["IRONCODE_CONFIG_DIR"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for IRONCODE_CLIENT
// This must be evaluated at access time, not module load time,
// because some commands override the client at runtime
Object.defineProperty(Flag, "IRONCODE_CLIENT", {
  get() {
    return process.env["IRONCODE_CLIENT"] ?? "cli"
  },
  enumerable: true,
  configurable: false,
})
