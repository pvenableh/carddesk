export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function fmtShort(d?: string) {
  if (!d) return ""
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function fmtFull(d?: string) {
  if (!d) return ""
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
