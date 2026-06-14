/**
 * 詳細入力画面。
 * 入力フォームを主役にし、比較の簡易確認は画面下部に小さく置くだけ。
 * 大きな詳細比較表はここに置かない（お客様説明モードへ集約）。
 */

import type { UseScenarioState } from '../../hooks/useScenarioState'
import type {
  BvcInput,
  CreditInput,
  CurrentCarInput,
  MaintenanceInput,
  OfficialQuoteInput,
  OmatomeInput,
  Scenario,
} from '../../domain/types'
import { CAR_TYPE_LABELS } from '../../domain/constants'
import { CheckField, MonthMultiSelect, SelectField, TextField, YenInput } from '../common/inputs'
import { formatYen } from '../../utils/format'

/** 契約年数プリセット。年→月数(×12)に変換して months を設定する。 */
function PresetYears({
  label,
  months,
  years,
  onSelect,
}: {
  label: string
  months: number
  years: number[]
  onSelect: (months: number) => void
}) {
  return (
    <div className="field field--full">
      <span className="field__label">{label}</span>
      <div className="preset">
        {years.map((y) => {
          const mo = y * 12
          return (
            <button
              type="button"
              key={y}
              className={months === mo ? 'preset__btn is-on' : 'preset__btn'}
              onClick={() => onSelect(mo)}
            >
              {y}年
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** 正式見積（手入力）セクション。ONのとき初回/2回目以降月額/回数を手入力できる。 */
function OfficialQuoteSection({
  official,
  onChange,
}: {
  official: OfficialQuoteInput | undefined
  onChange: (partial: Partial<OfficialQuoteInput>) => void
}) {
  const on = Boolean(official?.useOfficialQuote)
  return (
    <div className="field field--full officialquote">
      <CheckField
        label="正式見積（手入力）を使う"
        checked={on}
        onChange={(v) => onChange({ useOfficialQuote: v })}
      />
      {on ? (
        <div className="officialquote__grid">
          <YenInput
            label="初回支払額"
            value={official?.firstPayment ?? ''}
            optional
            onChange={() => {}}
            onChangeOptional={(v) => onChange({ firstPayment: v })}
            hint="未入力なら2回目以降月額と同額"
          />
          <YenInput
            label="2回目以降月額"
            value={official?.monthlyPayment ?? ''}
            optional
            onChange={() => {}}
            onChangeOptional={(v) => onChange({ monthlyPayment: v })}
          />
          <YenInput
            label="2回目以降回数"
            value={official?.monthlyCount ?? ''}
            optional
            suffix="回"
            onChange={() => {}}
            onChangeOptional={(v) => onChange({ monthlyCount: v })}
          />
        </div>
      ) : null}
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="formsec">
      <div className="formsec__head">
        <h2 className="formsec__title">{title}</h2>
        {description ? <p className="formsec__desc">{description}</p> : null}
      </div>
      <div className="formsec__grid">{children}</div>
    </section>
  )
}

export function InputScreen({ state }: { state: UseScenarioState }) {
  const { scenario, result, setScenario, patch, changeCarType } = state

  const setCurrentCar = (partial: Partial<CurrentCarInput>) =>
    setScenario((p) => ({ ...p, currentCar: { ...p.currentCar, ...partial } }))
  const setMaintenance = (partial: Partial<MaintenanceInput>) =>
    setScenario((p) => ({ ...p, maintenance: { ...p.maintenance, ...partial } }))
  const setCredit = (partial: Partial<CreditInput>) =>
    setScenario((p) => ({ ...p, credit: { ...p.credit, ...partial } }))
  const setBvc = (partial: Partial<BvcInput>) =>
    setScenario((p) => ({ ...p, bvc: { ...p.bvc, ...partial } }))
  const setOmatome = (partial: Partial<OmatomeInput>) =>
    setScenario((p) => ({ ...p, omatome: { ...p.omatome, ...partial } }))

  // 正式見積（手入力）の部分更新。
  const setCreditOfficial = (partial: Partial<OfficialQuoteInput>) =>
    setScenario((p) => ({ ...p, credit: { ...p.credit, official: { ...p.credit.official, ...partial } } }))
  const setBvcOfficial = (partial: Partial<OfficialQuoteInput>) =>
    setScenario((p) => ({ ...p, bvc: { ...p.bvc, official: { ...p.bvc.official, ...partial } } }))
  const setOmatomeOfficial = (partial: Partial<OfficialQuoteInput>) =>
    setScenario((p) => ({ ...p, omatome: { ...p.omatome, official: { ...p.omatome.official, ...partial } } }))

  const numField = (
    label: string,
    value: number,
    onChange: (n: number) => void,
    hint?: string,
    suffix?: string,
  ) => <YenInput label={label} value={value} onChange={onChange} hint={hint} suffix={suffix} />

  return (
    <div className="inputscreen">
      <Section title="見積条件" description="お客様・担当者・見積日を入力します。">
        <TextField
          label="顧客名"
          value={scenario.customerName}
          onChange={(v) => patch({ customerName: v })}
          placeholder="例: 日産 太郎 様"
        />
        <TextField
          label="担当者名"
          value={scenario.staffName}
          onChange={(v) => patch({ staffName: v })}
        />
        <TextField
          label="見積日"
          type="date"
          value={scenario.quoteDate}
          onChange={(v) => patch({ quoteDate: v })}
        />
        <TextField
          label="見積名（管理用）"
          value={scenario.name}
          onChange={(v) => patch({ name: v })}
        />
      </Section>

      <Section title="車両情報" description="購入する車両の価格条件を入力します。">
        <TextField
          label="車種名"
          value={scenario.vehicleName}
          onChange={(v) => patch({ vehicleName: v })}
          placeholder="例: ノート"
        />
        <TextField label="グレード" value={scenario.grade} onChange={(v) => patch({ grade: v })} />
        <SelectField
          label="新車 / 中古車"
          value={scenario.vehicleMode}
          options={[
            { value: 'new', label: '新車' },
            { value: 'used', label: '中古車' },
          ]}
          onChange={(v) => patch({ vehicleMode: v })}
        />
        <SelectField
          label="車両クラス（維持費の初期値）"
          value={scenario.carType}
          options={(Object.keys(CAR_TYPE_LABELS) as Scenario['carType'][]).map((k) => ({
            value: k,
            label: CAR_TYPE_LABELS[k],
          }))}
          onChange={(v) => changeCarType(v)}
        />
        <SelectField
          label="パワートレイン"
          value={scenario.powertrain}
          options={[
            { value: 'gasoline', label: 'ガソリン' },
            { value: 'hybrid', label: 'ハイブリッド / e-POWER' },
            { value: 'ev', label: 'EV' },
          ]}
          onChange={(v) => patch({ powertrain: v })}
        />
        {numField('車両本体価格', scenario.vehiclePrice, (n) => patch({ vehiclePrice: n }))}
        {numField('オプション', scenario.optionPrice, (n) => patch({ optionPrice: n }))}
        {numField('諸費用', scenario.taxAndFees, (n) => patch({ taxAndFees: n }))}
        {numField('値引き', scenario.discount, (n) => patch({ discount: n }))}
        {numField('下取り', scenario.tradeIn, (n) => patch({ tradeIn: n }), '車両見積総額を上限に控除されます')}
      </Section>

      <Section
        title="現在の車（現状維持の比較用）"
        description="過去の購入額または月の支払額を入力すると、比較に「現状維持」が表示されます。"
      >
        <YenInput
          label="過去の購入額"
          value={scenario.currentCar.originalPurchasePrice}
          optional
          onChange={() => {}}
          onChangeOptional={(v) => setCurrentCar({ originalPurchasePrice: v })}
        />
        <YenInput
          label="月の支払額"
          value={scenario.currentCar.monthlyPayment}
          optional
          onChange={() => {}}
          onChangeOptional={(v) => setCurrentCar({ monthlyPayment: v })}
        />
        <YenInput
          label="ローン残債"
          value={scenario.currentCar.remainingLoanBalance}
          optional
          onChange={() => {}}
          onChangeOptional={(v) => setCurrentCar({ remainingLoanBalance: v })}
        />
        <YenInput
          label="残りローン回数"
          value={scenario.currentCar.remainingLoanMonths}
          optional
          suffix="回"
          onChange={() => {}}
          onChangeOptional={(v) => setCurrentCar({ remainingLoanMonths: v })}
        />
        <YenInput
          label="自動車税（年額）"
          value={scenario.currentCar.annualTax}
          optional
          onChange={() => {}}
          onChangeOptional={(v) => setCurrentCar({ annualTax: v })}
        />
        <YenInput
          label="車検（1回あたり）"
          value={scenario.currentCar.inspectionCost}
          optional
          onChange={() => {}}
          onChangeOptional={(v) => setCurrentCar({ inspectionCost: v })}
        />
        <YenInput
          label="維持費（年あたり）"
          value={scenario.currentCar.maintenanceCost}
          optional
          onChange={() => {}}
          onChangeOptional={(v) => setCurrentCar({ maintenanceCost: v })}
        />
        <YenInput
          label="夏・冬タイヤ（1回あたり）"
          value={scenario.currentCar.tireCost}
          optional
          onChange={() => {}}
          onChangeOptional={(v) => setCurrentCar({ tireCost: v })}
        />
        <YenInput
          label="任意保険（月額）"
          value={scenario.currentCar.insuranceMonthly}
          optional
          onChange={() => {}}
          onChangeOptional={(v) => setCurrentCar({ insuranceMonthly: v })}
        />
      </Section>

      <Section title="維持費条件" description="新車購入後の維持費の前提を入力します。">
        {numField(
          'シミュレーション年数',
          scenario.maintenance.simulationYears,
          (n) => setMaintenance({ simulationYears: Math.max(1, n) }),
          undefined,
          '年',
        )}
        {numField('車検（1回あたり）', toNum(scenario.maintenance.inspectionCost), (n) =>
          setMaintenance({ inspectionCost: n }),
        )}
        {numField('法定12か月点検', toNum(scenario.maintenance.legalInspectionCost), (n) =>
          setMaintenance({ legalInspectionCost: n }),
        )}
        {numField('6か月点検', toNum(scenario.maintenance.sixMonthInspectionCost), (n) =>
          setMaintenance({ sixMonthInspectionCost: n }),
        )}
        {numField('自動車税（年額）', toNum(scenario.maintenance.annualTax), (n) =>
          setMaintenance({ annualTax: n }),
        )}
        {numField('夏・冬タイヤ（1回あたり）', toNum(scenario.maintenance.tireCost), (n) =>
          setMaintenance({ tireCost: n }),
        )}
        {numField(
          '夏・冬タイヤ 交換周期',
          scenario.maintenance.tireReplacementCycleYears,
          (n) => setMaintenance({ tireReplacementCycleYears: Math.max(1, n) }),
          undefined,
          '年ごと',
        )}
        <div className="field field--full">
          <CheckField
            label="任意保険を維持費に含める"
            checked={scenario.maintenance.includeInsurance}
            onChange={(v) => setMaintenance({ includeInsurance: v })}
          />
          <YenInput
            label="任意保険（月額）※未入力可"
            value={scenario.maintenance.insuranceMonthly}
            optional
            onChange={() => {}}
            onChangeOptional={(v) => setMaintenance({ insuranceMonthly: v })}
            hint="初期値は未入力です。必要に応じて入力してください。"
          />
        </div>
      </Section>

      <Section title="クレジット条件">
        {numField('頭金', scenario.credit.downPayment, (n) => setCredit({ downPayment: n }))}
        {numField('支払回数', scenario.credit.months, (n) => setCredit({ months: n }), undefined, '回')}
        <YenInput
          label="実質年率"
          value={scenario.credit.annualRate}
          suffix="%"
          onChange={(n) => setCredit({ annualRate: n })}
        />
        {numField('ボーナス加算額', scenario.credit.bonusPayment, (n) =>
          setCredit({ bonusPayment: n }),
        )}
        <MonthMultiSelect
          label="ボーナス加算月"
          selected={scenario.credit.bonusMonths}
          onChange={(months) => setCredit({ bonusMonths: months })}
          hint={`選択した月に加算（年${scenario.credit.bonusMonths.length}回 → 計${result.credit.bonusPaymentCount}回）`}
        />
        <OfficialQuoteSection official={scenario.credit.official} onChange={setCreditOfficial} />
      </Section>

      <Section title="BVC条件" description="残価据置型クレジット。残価は最終回に据え置かれます。">
        <PresetYears
          label="契約年数（プリセット）"
          months={scenario.bvc.months}
          years={[3, 4, 5]}
          onSelect={(mo) => setBvc({ months: mo })}
        />
        {numField('頭金', scenario.bvc.downPayment, (n) => setBvc({ downPayment: n }))}
        {numField('支払回数', scenario.bvc.months, (n) => setBvc({ months: n }), undefined, '回')}
        <YenInput
          label="実質年率"
          value={scenario.bvc.annualRate}
          suffix="%"
          onChange={(n) => setBvc({ annualRate: n })}
        />
        {numField('残価（最終回据置）', scenario.bvc.residualValue, (n) =>
          setBvc({ residualValue: n }),
        )}
        <YenInput
          label="概算残価率"
          value={scenario.bvc.residualRate ?? ''}
          optional
          suffix="%"
          onChange={() => {}}
          onChangeOptional={(v) => setBvc({ residualRate: v === '' ? undefined : v })}
          hint="残価が未入力(0)のときのみ、見積総額×率で残価を概算します"
        />
        {numField('ボーナス加算額', scenario.bvc.bonusPayment, (n) => setBvc({ bonusPayment: n }))}
        <MonthMultiSelect
          label="ボーナス加算月"
          selected={scenario.bvc.bonusMonths}
          onChange={(months) => setBvc({ bonusMonths: months })}
          hint={`選択した月に加算（年${scenario.bvc.bonusMonths.length}回 → 計${result.bvc.bonusPaymentCount}回）`}
        />
        <SelectField
          label="返却 / 買取"
          value={scenario.bvc.mode}
          options={[
            { value: 'return', label: '返却' },
            { value: 'purchase', label: '買取' },
          ]}
          onChange={(v) => setBvc({ mode: v })}
        />
        <OfficialQuoteSection official={scenario.bvc.official} onChange={setBvcOfficial} />
      </Section>

      <Section
        title="おまとめプラン条件"
        description="車両費用と維持費をまとめて分割します。含める項目を選択してください。"
      >
        <PresetYears
          label="契約年数（プリセット）"
          months={scenario.omatome.months}
          years={[3, 5, 7]}
          onSelect={(mo) => setOmatome({ months: mo })}
        />
        {numField('頭金（前払金）', scenario.omatome.downPayment, (n) => setOmatome({ downPayment: n }))}
        {numField('支払回数', scenario.omatome.months, (n) => setOmatome({ months: n }), undefined, '回')}
        <YenInput
          label="実質年率"
          value={scenario.omatome.annualRate}
          suffix="%"
          onChange={(n) => setOmatome({ annualRate: n })}
        />
        <div className="field field--full omatome__includes">
          <span className="field__label">おまとめに含める維持費</span>
          <div className="omatome__checks">
            <CheckField
              label="車検"
              checked={scenario.omatome.includeInspection}
              onChange={(v) => setOmatome({ includeInspection: v })}
            />
            <CheckField
              label="法定12か月点検"
              checked={scenario.omatome.includeLegalInspection}
              onChange={(v) => setOmatome({ includeLegalInspection: v })}
            />
            <CheckField
              label="6か月点検"
              checked={scenario.omatome.includeSixMonthInspection}
              onChange={(v) => setOmatome({ includeSixMonthInspection: v })}
            />
            <CheckField
              label="夏・冬タイヤ"
              checked={scenario.omatome.includeTires}
              onChange={(v) => setOmatome({ includeTires: v })}
            />
            <CheckField
              label="自動車税"
              checked={scenario.omatome.includeTax}
              onChange={(v) => setOmatome({ includeTax: v })}
            />
            <CheckField
              label="任意保険"
              checked={scenario.omatome.includeInsurance}
              onChange={(v) => setOmatome({ includeInsurance: v })}
            />
          </div>
        </div>
        <OfficialQuoteSection official={scenario.omatome.official} onChange={setOmatomeOfficial} />
      </Section>

      {/* 入力作業の邪魔をしない、最小限の簡易結果（詳細はお客様説明モードへ）。 */}
      <section className="quickresult" aria-label="簡易結果">
        <h2 className="quickresult__title">簡易結果（実質月額）</h2>
        <div className="quickresult__row">
          <span>現金一括</span>
          <span className="quickresult__val">{formatYen(result.cash.effectiveMonthly)}</span>
        </div>
        <div className="quickresult__row">
          <span>クレジット</span>
          <span className="quickresult__val">{formatYen(result.credit.effectiveMonthly)}</span>
        </div>
        <div className="quickresult__row">
          <span>BVC</span>
          <span className="quickresult__val">{formatYen(result.bvc.effectiveMonthly)}</span>
        </div>
        <div className="quickresult__row">
          <span>おまとめプラン</span>
          <span className="quickresult__val">{formatYen(result.omatome.effectiveMonthly)}</span>
        </div>
        <p className="quickresult__hint">
          詳細な5プラン比較は「お客様説明モード」でご確認ください。
        </p>
      </section>
    </div>
  )
}

/** number | '' を表示用 number へ（'' は 0 表示）。入力欄では YenInput が空表示を担う。 */
function toNum(v: number | ''): number {
  return v === '' ? 0 : v
}
