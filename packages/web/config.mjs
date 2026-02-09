const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://ironcode.cloud" : `https://${stage}.ironcode.cloud`,
  console: stage === "production" ? "https://ironcode.cloud/auth" : `https://${stage}.ironcode.cloud/auth`,
  email: "contact@anoma.ly",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/anomalyco/ironcode",
  discord: "https://ironcode.cloud/discord",
  headerLinks: [
    { name: "Home", url: "/" },
    { name: "Docs", url: "/docs/" },
  ],
}
