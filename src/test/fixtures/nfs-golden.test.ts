import { describe, it, expect } from 'vitest'
import { NFS_GOLDEN, isFilled, type NfsGoldenEntry } from './nfs-golden'
import { computeInstallment } from '../../domain/installment'

/**
 * NFS支払予定表との1円単位一致を検証する。
 * 実値未転記（expected が全て null）のエントリは skip する。
 */
describe('NFS ゴールデンテスト（突合）', () => {
  const filled = NFS_GOLDEN.filter(isFilled)

  if (filled.length === 0) {
    it.skip('NFS実データ未転記のためskip（nfs-golden.ts に転記してください）', () => {})
    return
  }

  it.each(filled)('$label が1円単位で一致', (entry: NfsGoldenEntry) => {
    const principal = Math.max(0, entry.input.payableTotal - entry.input.downPayment)
    const inst = computeInstallment({
      principal,
      months: entry.input.months,
      annualRate: entry.input.annualRate,
      residual: entry.input.residualValue,
      includeResidualInTotal: entry.kind === 'bvc' ? entry.input.mode === 'purchase' : true,
      bonusPayment: entry.input.bonusPayment,
      bonusMonths: entry.input.bonusMonths,
    })
    const e = entry.expected
    if (e.initialPayment !== null) expect(inst.initialPayment).toBe(e.initialPayment)
    if (e.equalMonthly !== null) expect(inst.equalMonthly).toBe(e.equalMonthly)
    if (e.totalPayment !== null) {
      expect(inst.totalPayment + entry.input.downPayment).toBe(e.totalPayment)
    }
    if (e.finalPayment !== null) expect(inst.finalPayment).toBe(e.finalPayment)
  })
})
