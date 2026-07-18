import { describe, it } from 'vitest'
import { calculatePaymentSchedule } from '../domain/payment'
import { nfsGoldenFixtures } from './fixtures/nfs-golden'

describe.skipIf(nfsGoldenFixtures.length === 0)('NFS golden fixtures', () => {
  for (const fixture of nfsGoldenFixtures) {
    it(fixture.name, ({ expect }) => {
      const actual = calculatePaymentSchedule(fixture.input)
      expect(actual.firstPayment).toBe(fixture.expected.firstPayment)
      expect(actual.secondAndLaterMonthlyPayment).toBe(
        fixture.expected.secondAndLaterMonthlyPayment,
      )
      expect(actual.totalPayment).toBe(fixture.expected.totalPayment)
    })
  }
})
