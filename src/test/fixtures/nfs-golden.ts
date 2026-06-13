/**
 * NFS（日産フィナンシャルサービス）支払予定表 突合用ゴールデンフィクスチャ。
 *
 * 目的: 本アプリのクレジット/BVC計算が、NFSの正式見積（支払予定表）と
 *       1円単位で一致することを検証するための「器」。
 *
 * 使い方:
 *   1. NFSの支払シミュレーション／実際の支払予定表から、入力と期待値を転記する。
 *   2. 各エントリの `expected` を実値で埋め、ファイル先頭の TODO を消す。
 *   3. テスト（nfs-golden.test.ts）が自動で総当たり検証する。
 *
 * 注意:
 *   - 実値が未転記（プレースホルダ）の間は、テストは skip される。
 *   - kind: 'credit' は通常クレジット、'bvc' は残価据置型。
 *
 * TODO(SPEC): 下記サンプルの expected はプレースホルダ（null）。実データを転記すること。
 */

export type NfsGoldenKind = 'credit' | 'bvc'

export type NfsGoldenEntry = {
  /** 識別名（支払予定表の見積番号など） */
  label: string
  kind: NfsGoldenKind
  input: {
    /** 支払対象総額（車両見積総額 − 下取り） */
    payableTotal: number
    downPayment: number
    /** 実質年率(%) */
    annualRate: number
    months: number
    /** ボーナス加算額（無ければ0） */
    bonusPayment: number
    /** ボーナス加算月（無ければ []） */
    bonusMonths: number[]
    /** BVC残価（kind='bvc'のみ。creditは0） */
    residualValue: number
    /** BVCモード（kind='bvc'のみ） */
    mode?: 'return' | 'purchase'
  }
  /** 期待値。null のうちは未転記としてskip対象。 */
  expected: {
    initialPayment: number | null
    equalMonthly: number | null
    totalPayment: number | null
    /** BVCの最終回（残価）。creditは0。 */
    finalPayment: number | null
  }
}

/**
 * 実データを転記するエントリ群。
 * 現状はサンプル1件のみ（expected は全て null = 未転記 → skip）。
 */
export const NFS_GOLDEN: NfsGoldenEntry[] = [
  {
    label: 'SAMPLE-001（要NFS転記）',
    kind: 'credit',
    input: {
      payableTotal: 2_500_000,
      downPayment: 300_000,
      annualRate: 3.9,
      months: 60,
      bonusPayment: 0,
      bonusMonths: [],
      residualValue: 0,
    },
    expected: {
      // TODO(SPEC): NFS支払予定表から転記。
      initialPayment: null,
      equalMonthly: null,
      totalPayment: null,
      finalPayment: null,
    },
  },
  {
    label: 'SAMPLE-BVC-001（要NFS転記）',
    kind: 'bvc',
    input: {
      payableTotal: 3_000_000,
      downPayment: 0,
      annualRate: 3.9,
      months: 60,
      bonusPayment: 0,
      bonusMonths: [],
      residualValue: 1_200_000,
      mode: 'purchase',
    },
    expected: {
      // TODO(SPEC): NFS支払予定表から転記。
      initialPayment: null,
      equalMonthly: null,
      totalPayment: null,
      finalPayment: null,
    },
  },
]

/** expected が1つでも実値で埋まっているエントリだけを検証対象にする。 */
export function isFilled(entry: NfsGoldenEntry): boolean {
  return Object.values(entry.expected).some((v) => v !== null)
}
