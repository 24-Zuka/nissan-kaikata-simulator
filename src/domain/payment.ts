import Decimal from 'decimal.js'
import { ceilYen, decimal, floorYen, normalizeYen, roundYen } from './money'
import type { MoneyInput, PaymentSchedule, PaymentScheduleInput } from './types'

export function hasManualPaymentInput(
  firstPayment: MoneyInput,
  monthlyPayment: MoneyInput,
): boolean {
  return firstPayment !== '' || monthlyPayment !== ''
}

export function calculateManualPaymentSchedule(
  input: PaymentScheduleInput & {
    firstPayment: MoneyInput
    monthlyPayment: MoneyInput
  },
): PaymentSchedule {
  const normalized = normalizedInput(input)
  const monthlyPayment = normalizeYen(input.monthlyPayment)
  const firstPayment = input.firstPayment === ''
    ? monthlyPayment
    : normalizeYen(input.firstPayment)
  const bonusPaymentCount = Math.floor(
    normalized.regularPaymentCount / normalized.bonusInterval,
  )
  const regularTotal = normalized.regularPaymentCount > 0
    ? firstPayment + monthlyPayment * (normalized.regularPaymentCount - 1)
    : 0
  const totalPayment = roundYen(
    new Decimal(regularTotal)
      .plus(normalized.bonusPayment * bonusPaymentCount)
      .plus(normalized.residualValue),
  )
  const warnings: string[] = []

  if (input.monthlyPayment === '') {
    warnings.push('2回目以降月額を入力してください。')
  }
  if (totalPayment < normalized.principal) {
    warnings.push('入力した支払額の合計が元金を下回っています。')
  }

  return {
    firstPayment,
    secondAndLaterMonthlyPayment: monthlyPayment,
    regularPaymentCount: normalized.regularPaymentCount,
    bonusPayment: normalized.bonusPayment,
    bonusPaymentCount,
    residualValue: normalized.residualValue,
    totalPayment,
    interestFee: Math.max(0, totalPayment - normalized.principal),
    minimumEqualMonthlyPayment: 0,
    warnings,
  }
}

function normalizedInput(input: PaymentScheduleInput) {
  const paymentCount = Math.max(0, Math.floor(input.paymentCount || 0))
  const regularPaymentCount = Math.max(
    0,
    Math.min(paymentCount, Math.floor(input.regularPaymentCount ?? paymentCount)),
  )
  const annualRate = Math.max(0, Number(input.annualRate || 0))
  const monthlyRate = new Decimal(annualRate).div(100).div(12)
  const bonusInterval = Math.max(1, Math.floor(input.bonusInterval ?? 6))
  const bonusPayment = normalizeYen(input.bonusPayment)
  const residualValue = normalizeYen(input.residualValue)

  return {
    principal: normalizeYen(input.principal),
    paymentCount,
    regularPaymentCount,
    annualRate,
    monthlyRate,
    bonusInterval,
    bonusPayment,
    residualValue,
  }
}

function discountFactor(rate: Decimal, month: number): Decimal {
  return new Decimal(1).plus(rate).pow(month)
}

function presentValueAtStart(
  amount: Decimal.Value,
  rate: Decimal,
  month: number,
): Decimal {
  return decimal(amount).div(discountFactor(rate, month))
}

function getBonusMonths(regularPaymentCount: number, interval: number): number[] {
  const months: number[] = []
  for (let month = interval; month <= regularPaymentCount; month += interval) months.push(month)
  return months
}

function calculateBasePaymentExact(input: PaymentScheduleInput): Decimal {
  const normalized = normalizedInput(input)
  if (normalized.principal <= 0 || normalized.regularPaymentCount <= 0) return new Decimal(0)

  const bonusMonths = getBonusMonths(
    normalized.regularPaymentCount,
    normalized.bonusInterval,
  )
  const bonusPv = bonusMonths.reduce(
    (sum, month) =>
      sum.plus(presentValueAtStart(normalized.bonusPayment, normalized.monthlyRate, month)),
    new Decimal(0),
  )
  const residualPv =
    normalized.residualValue > 0 && normalized.paymentCount > 0
      ? presentValueAtStart(
          normalized.residualValue,
          normalized.monthlyRate,
          normalized.paymentCount,
        )
      : new Decimal(0)
  const annuityFactor = Array.from(
    { length: normalized.regularPaymentCount },
    (_, index) => index + 1,
  ).reduce(
    (sum, month) =>
      sum.plus(presentValueAtStart(1, normalized.monthlyRate, month)),
    new Decimal(0),
  )
  const availablePrincipal = new Decimal(normalized.principal).minus(bonusPv).minus(residualPv)

  if (availablePrincipal.lte(0) || annuityFactor.lte(0)) return new Decimal(0)
  return availablePrincipal.div(annuityFactor)
}

export function canRepay(input: PaymentScheduleInput, monthlyPayment: number): boolean {
  const normalized = normalizedInput(input)
  if (normalized.principal <= 0) return true
  if (normalized.regularPaymentCount <= 0) {
    return normalized.residualValue >= normalized.principal
  }

  const equalMonthly = normalizeYen(monthlyPayment)
  const bonusMonths = new Set(
    getBonusMonths(normalized.regularPaymentCount, normalized.bonusInterval),
  )
  let presentValue = new Decimal(0)

  for (let month = 1; month <= normalized.regularPaymentCount; month += 1) {
    const payment = equalMonthly + (bonusMonths.has(month) ? normalized.bonusPayment : 0)
    presentValue = presentValue.plus(
      presentValueAtStart(payment, normalized.monthlyRate, month),
    )
  }

  if (normalized.residualValue > 0 && normalized.paymentCount > 0) {
    presentValue = presentValue.plus(
      presentValueAtStart(
        normalized.residualValue,
        normalized.monthlyRate,
        normalized.paymentCount,
      ),
    )
  }

  return presentValue.gte(normalized.principal)
}

export function calculatePaymentSchedule(input: PaymentScheduleInput): PaymentSchedule {
  const normalized = normalizedInput(input)
  const warnings: string[] = []

  if (normalized.principal <= 0 || normalized.paymentCount <= 0) {
    return {
      firstPayment: 0,
      secondAndLaterMonthlyPayment: 0,
      regularPaymentCount: normalized.regularPaymentCount,
      bonusPayment: normalized.bonusPayment,
      bonusPaymentCount: 0,
      residualValue: normalized.residualValue,
      totalPayment: normalized.residualValue,
      interestFee: Math.max(0, normalized.residualValue - normalized.principal),
      minimumEqualMonthlyPayment: 0,
      warnings,
    }
  }

  if (normalized.regularPaymentCount <= 0) {
    warnings.push('通常支払回数が0回のため、最終回支払のみで計算しました。')
    return {
      firstPayment: 0,
      secondAndLaterMonthlyPayment: 0,
      regularPaymentCount: 0,
      bonusPayment: 0,
      bonusPaymentCount: 0,
      residualValue: normalized.residualValue,
      totalPayment: normalized.residualValue,
      interestFee: Math.max(0, normalized.residualValue - normalized.principal),
      minimumEqualMonthlyPayment: 0,
      warnings,
    }
  }

  const baseExact = calculateBasePaymentExact(input)
  const secondPayment = floorYen(baseExact)
  const minimumEqualMonthlyPayment = ceilYen(baseExact)
  const bonusMonths = getBonusMonths(
    normalized.regularPaymentCount,
    normalized.bonusInterval,
  )

  let futurePv = new Decimal(0)
  for (let month = 2; month <= normalized.regularPaymentCount; month += 1) {
    const payment =
      secondPayment + (bonusMonths.includes(month) ? normalized.bonusPayment : 0)
    futurePv = futurePv.plus(
      presentValueAtStart(payment, normalized.monthlyRate, month),
    )
  }

  if (normalized.residualValue > 0) {
    futurePv = futurePv.plus(
      presentValueAtStart(
        normalized.residualValue,
        normalized.monthlyRate,
        normalized.paymentCount,
      ),
    )
  }

  const firstBonus = bonusMonths.includes(1) ? normalized.bonusPayment : 0
  const requiredFirstAtMonthOne = new Decimal(normalized.principal)
    .minus(futurePv)
    .mul(new Decimal(1).plus(normalized.monthlyRate))
    .minus(firstBonus)
  const firstPayment = ceilYen(requiredFirstAtMonthOne)
  const bonusTotal = normalized.bonusPayment * bonusMonths.length
  const regularTotal =
    firstPayment + secondPayment * Math.max(0, normalized.regularPaymentCount - 1)
  const totalPayment = roundYen(
    new Decimal(regularTotal).plus(bonusTotal).plus(normalized.residualValue),
  )

  if (baseExact.lte(0) && normalized.principal > normalized.residualValue) {
    warnings.push('ボーナス支払または残価が元金に対して大きいため、通常月額を0円で計算しました。')
  }

  return {
    firstPayment,
    secondAndLaterMonthlyPayment: secondPayment,
    regularPaymentCount: normalized.regularPaymentCount,
    bonusPayment: normalized.bonusPayment,
    bonusPaymentCount: bonusMonths.length,
    residualValue: normalized.residualValue,
    totalPayment,
    interestFee: Math.max(0, totalPayment - normalized.principal),
    minimumEqualMonthlyPayment,
    warnings,
  }
}
