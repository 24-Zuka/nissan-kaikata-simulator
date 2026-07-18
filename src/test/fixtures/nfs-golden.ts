import type { PaymentScheduleInput } from '../../domain/types'

export type NfsGoldenFixture = {
  name: string
  input: PaymentScheduleInput
  expected: {
    firstPayment: number
    secondAndLaterMonthlyPayment: number
    totalPayment: number
  }
}

// TODO: NFSの実支払予定表を確認できた時点で、転記したケースを追加する。
export const nfsGoldenFixtures: NfsGoldenFixture[] = []
