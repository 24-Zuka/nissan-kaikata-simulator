export const BVC_PAYMENT_COUNTS = [36, 48, 60] as const
export const OMATOME_PAYMENT_COUNTS = [36, 60, 84] as const

export function paymentCountToYears(paymentCount: number): number {
  return Math.max(1, Math.round(paymentCount / 12))
}

export function normalizePaymentCount(
  value: unknown,
  allowed: readonly number[],
): number {
  const paymentCount = typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value)
    : allowed[0]
  return allowed.reduce((closest, candidate) => {
    const distance = Math.abs(candidate - paymentCount)
    const closestDistance = Math.abs(closest - paymentCount)
    return distance < closestDistance || (distance === closestDistance && candidate < closest)
      ? candidate
      : closest
  }, allowed[0])
}

export function normalizePurchaseMaintenanceYears(value: unknown, minimum: number): number {
  const years = typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value)
    : minimum
  return Math.min(20, Math.max(minimum, years))
}
