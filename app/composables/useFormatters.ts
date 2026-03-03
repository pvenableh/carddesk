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

export function fmtRelative(d?: string) {
  if (!d) return ""
  const date = d.includes("T") ? new Date(d) : new Date(d + "T00:00:00")
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const days = Math.floor(diff / 86400)
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  return fmtShort(d.slice(0, 10))
}
