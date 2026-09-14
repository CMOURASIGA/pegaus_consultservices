export type ScrollMetrics = {
  scrollHeight: number
  scrollTop: number
  clientHeight: number
}

export function isNearConversationEnd(metrics: ScrollMetrics, threshold = 120) {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight < threshold
}

export function composerHeight(scrollHeight: number, minimum = 44, maximum = 160) {
  return Math.min(Math.max(scrollHeight, minimum), maximum)
}
