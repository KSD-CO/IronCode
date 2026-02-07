export function gitlabAuthPlugin(opts?: any) {
  return {
    name: "gitlab-auth-plugin-stub",
    async setup() {
      // stub no-op implementation for local development
      return {}
    },
    options: opts,
  }
}

export default gitlabAuthPlugin
