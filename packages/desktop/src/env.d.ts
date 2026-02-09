declare global {
  interface Window {
    __IRONCODE__?: {
      updaterEnabled?: boolean
      serverPassword?: string
      deepLinks?: string[]
    }
  }
}

export {}
