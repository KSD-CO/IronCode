const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://ironcode.ai" : `https://${stage}.ironcode.ai`,
  console: stage === "production" ? "https://ironcode.ai/auth" : `https://${stage}.ironcode.ai/auth`,
  email: "contact@anoma.ly",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/anomalyco/ironcode",
  discord: "https://ironcode.ai/discord",
  headerLinks: [
    { name: "Home", url: "/" },
    { name: "Docs", url: "/docs/" },
  ],
}
