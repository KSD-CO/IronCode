interface ImportMetaEnv {
  readonly VITE_IRONCODE_SERVER_HOST: string
  readonly VITE_IRONCODE_SERVER_PORT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
