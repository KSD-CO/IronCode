/**
 * Application-wide constants and configuration
 */
export const config = {
  // Base URL
  baseUrl: "https://ironcode.ai",

  // GitHub
  github: {
    repoUrl: "https://github.com/anomalyco/ironcode",
    starsFormatted: {
      compact: "95K",
      full: "95,000",
    },
  },

  // Social links
  social: {
    twitter: "https://x.com/ironcode",
    discord: "https://discord.gg/ironcode",
  },

  // Static stats (used on landing page)
  stats: {
    contributors: "650",
    commits: "8,500",
    monthlyUsers: "2.5M",
  },
} as const
