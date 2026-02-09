export const domain = (() => {
  if ($app.stage === "production") return "ironcode.cloud"
  if ($app.stage === "dev") return "dev.ironcode.cloud"
  return `${$app.stage}.dev.ironcode.cloud`
})()

export const zoneID = "430ba34c138cfb5360826c4909f99be8"

new cloudflare.RegionalHostname("RegionalHostname", {
  hostname: domain,
  regionKey: "us",
  zoneId: zoneID,
})

export const shortDomain = (() => {
  if ($app.stage === "production") return "ironcode.cloud"
  if ($app.stage === "dev") return "dev.ironcode.cloud"
  return `${$app.stage}.dev.ironcode.cloud`
})()
