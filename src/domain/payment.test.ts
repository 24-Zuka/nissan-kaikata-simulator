import { describe, expect, it } from 'vitest'
import { calculatePaymentSchedule, canRepay } from './payment'

describe('payment schedule', () => {
  it('creates a zero-rate schedule with first-payment adjustment', () => {
    const input = {
      principal: 1_000_003,
      annualRate: 0,
      paymentCount: 12,
      bonusPayment: 0,
    }
    const schedule = calculatePaymentSchedule(input)

    expect(schedule.secondAndLaterMonthlyPayment).toBe(83_333)
    expect(schedule.firstPayment).toBe(83_340)
    expect(schedule.totalPayment).toBe(1_000_003)
    expect(schedule.interestFee).toBe(0)
  })

  it('calculates interest and six-month bonus occurrences', () => {
    const input = {
      principal: 3_000_000,
      annualRate: 4.9,
      paymentCount: 60,
      bonusPayment: 50_000,
    }
    const schedule = calculatePaymentSchedule(input)

    expect(schedule.bonusPaymentCount).toBe(10)
    expect(schedule.totalPayment).toBeGreaterThan(3_000_000)
    expect(canRepay(input, schedule.minimumEqualMonthlyPayment)).toBe(true)
    expect(canRepay(input, schedule.minimumEqualMonthlyPayment - 1)).toBe(false)
  })

  it('returns a safe zero series for degenerate input', () => {
    const schedule = calculatePaymentSchedule({
      principal: 0,
      annualRate: 4.9,
      paymentCount: 0,
    })

    expect(schedule.firstPayment).toBe(0)
    expect(schedule.totalPayment).toBe(0)
  })
})
