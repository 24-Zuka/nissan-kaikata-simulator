import { Field, FormSection, NumberField, SelectField, TextField } from '../../components/FormControls'
import { QuickResults } from '../../components/ResultViews'
import { MAINTENANCE_DEFAULTS } from '../../domain/defaults'
import { formatYen } from '../../domain/money'
import { hasManualPaymentInput } from '../../domain/payment'
import {
  BVC_PAYMENT_COUNTS,
  OMATOME_PAYMENT_COUNTS,
  paymentCountToYears,
} from '../../domain/planTerms'
import type {
  ComparisonResult,
  MaintenanceInput,
  MoneyInput,
  PurchasablePlanId,
  Scenario,
  ScenarioSectionId,
  VehicleClass,
} from '../../domain/types'

type Props = {
  scenario: Scenario
  result: ComparisonResult
  onChange: (scenario: Scenario) => void
}

type ScenarioSection = Exclude<keyof Scenario, 'schemaVersion'>

function PaymentEntryStatus({
  firstPayment,
  monthlyPayment,
}: {
  firstPayment: MoneyInput
  monthlyPayment: MoneyInput
}) {
  const manual = hasManualPaymentInput(firstPayment, monthlyPayment)
  let description = '支払額欄を空欄にすると、車両価格・金利・回数から自動計算します。'
  if (manual && monthlyPayment === '') {
    description = '手入力で試算するには、2回目以降月額を入力してください。'
  } else if (manual && firstPayment === '') {
    description = '初回支払額は、2回目以降月額と同額で計算します。'
  } else if (manual) {
    description = '初回支払額と2回目以降月額から支払総額を計算します。'
  }

  return (
    <div className="calculation-note field--wide">
      <strong>{manual ? '入力した支払額で試算' : '金利から自動計算'}</strong>
      <span>{description}</span>
    </div>
  )
}

export function DetailInputScreen({ scenario, result, onChange }: Props) {
  const cashResult = result.plans.find((plan) => plan.planId === 'cash')
  const statusQuoResult = result.plans.find((plan) => plan.planId === 'statusQuo')
  const creditManualPayment = hasManualPaymentInput(
    scenario.credit.firstPayment,
    scenario.credit.monthlyPayment,
  )
  const bvcManualPayment = hasManualPaymentInput(
    scenario.bvc.firstPayment,
    scenario.bvc.monthlyPayment,
  )
  const errorFor = (sectionId: ScenarioSectionId, fieldId: string) =>
    result.validationIssues.find(
      (issue) => issue.sectionId === sectionId && issue.fieldId === fieldId,
    )?.message
  const update = <K extends ScenarioSection>(
    section: K,
    patch: Partial<Scenario[K]>,
  ) => {
    onChange({
      ...scenario,
      [section]: {
        ...scenario[section],
        ...patch,
      },
    })
  }

  const changeVehicleClass = (vehicleClass: VehicleClass) => {
    const defaults = MAINTENANCE_DEFAULTS[vehicleClass]
    onChange({
      ...scenario,
      vehicle: {
        ...scenario.vehicle,
        vehicleClass,
      },
      newMaintenance: {
        ...scenario.newMaintenance,
        ...defaults,
      },
      usedMaintenance: {
        ...scenario.usedMaintenance,
        ...defaults,
      },
    })
  }

  const updatePlanVisibility = (planId: PurchasablePlanId, enabled: boolean) => {
    update('comparison', {
      enabledPlans: {
        ...scenario.comparison.enabledPlans,
        [planId]: enabled,
      },
    })
  }

  const renderPurchaseMaintenanceSection = (
    section: 'newMaintenance' | 'usedMaintenance',
    title: string,
    description: string,
    includeAnchor = true,
  ) => {
    const maintenance = scenario[section]
    const updateMaintenance = (patch: Partial<MaintenanceInput>) => update(section, patch)

    return (
      <FormSection
        id={includeAnchor ? `section-${section}` : undefined}
        title={title}
        description={description}
      >
        <NumberField
          label="車検費用"
          value={maintenance.inspectionCost}
          onValueChange={(inspectionCost) => updateMaintenance({ inspectionCost })}
        />
        <NumberField
          label="法定12か月点検"
          value={maintenance.legalInspectionCost}
          onValueChange={(legalInspectionCost) => updateMaintenance({ legalInspectionCost })}
        />
        <NumberField
          label="6か月点検"
          value={maintenance.sixMonthInspectionCost}
          onValueChange={(sixMonthInspectionCost) => updateMaintenance({ sixMonthInspectionCost })}
        />
        <NumberField
          label="夏・冬タイヤ"
          value={maintenance.tireCost}
          onValueChange={(tireCost) => updateMaintenance({ tireCost })}
        />
        <NumberField
          label="タイヤ周期"
          suffix="年"
          min={1}
          max={20}
          value={maintenance.tireCycleYears}
          onValueChange={(tireCycleYears) =>
            updateMaintenance({
              tireCycleYears: Math.min(20, Math.max(1, Math.round(Number(tireCycleYears) || 1))),
            })
          }
        />
        <NumberField
          label="自動車税"
          value={maintenance.annualTax}
          onValueChange={(annualTax) => updateMaintenance({ annualTax })}
        />
        <NumberField
          label="任意保険"
          suffix="円/月"
          value={maintenance.monthlyInsurance}
          onValueChange={(monthlyInsurance) => updateMaintenance({ monthlyInsurance })}
          placeholder="未入力"
        />
        <NumberField
          label="修理費用"
          value={maintenance.repairCost}
          onValueChange={(repairCost) => updateMaintenance({ repairCost })}
          hint="入力した場合のみ、この区分の維持費へ1回分を反映します。"
        />
        <Field label="任意保険を含める">
          <label className="switch-row">
            <input
              type="checkbox"
              checked={maintenance.includeInsurance}
              onChange={(event) =>
                updateMaintenance({ includeInsurance: event.target.checked })
              }
            />
            <span>実質負担へ反映する</span>
          </label>
        </Field>
      </FormSection>
    )
  }

  const updateOmatomeInsurance = (checked: boolean) => {
    onChange({
      ...scenario,
      omatome: {
        ...scenario.omatome,
        included: {
          ...scenario.omatome.included,
          inspection: true,
          legalInspection: true,
          sixMonthInspection: true,
          tires: true,
          tax: true,
          insurance: checked,
        },
      },
    })
  }

  const updateBvcPaymentCount = (paymentCount: number) => {
    const minimumYears = paymentCountToYears(paymentCount)
    update('bvc', {
      paymentCount,
      bvcMaintenanceYears: Math.max(
        minimumYears,
        scenario.bvc.bvcMaintenanceYears,
      ),
    })
  }

  const updateOmatomePaymentCount = (paymentCount: number) => {
    const minimumYears = paymentCountToYears(paymentCount)
    update('omatome', {
      paymentCount,
      omatomeMaintenanceYears: Math.max(
        minimumYears,
        scenario.omatome.omatomeMaintenanceYears,
      ),
    })
  }

  return (
    <main className="input-layout">
      <div className="input-content">
        <div className="screen-intro">
          <div>
            <p className="eyebrow">商談条件の入力</p>
            <h1>詳細入力</h1>
          </div>
          <p>
            車両・支払・維持費の条件を入力してください。計算結果は右側で簡易確認できます。
          </p>
        </div>

        <FormSection id="section-quote" title="商談情報" description="保存名とお客様へ表示する基本情報です。">
          <TextField
            id="quote-scenarioName"
            label="案件名"
            required
            error={errorFor('quote', 'scenarioName')}
            value={scenario.quote.scenarioName}
            onValueChange={(scenarioName) => update('quote', { scenarioName })}
          />
          <TextField
            label="見積作成日"
            type="date"
            value={scenario.quote.quoteDate}
            onValueChange={(quoteDate) => update('quote', { quoteDate })}
          />
          <TextField
            label="担当者"
            value={scenario.quote.staffName}
            onValueChange={(staffName) => update('quote', { staffName })}
          />
          <TextField
            label="顧客名"
            value={scenario.quote.customerName}
            onValueChange={(customerName) => update('quote', { customerName })}
          />
          <TextField
            label="車種"
            value={scenario.quote.carName}
            onValueChange={(carName) => update('quote', { carName })}
          />
          <TextField
            label="グレード"
            value={scenario.quote.grade}
            onValueChange={(grade) => update('quote', { grade })}
          />
        </FormSection>

        <FormSection
          id="section-vehicle"
          title="車両情報"
          description="車両区分・クラス・動力を選択してください。"
        >
          <SelectField
            label="車両区分"
            value={scenario.vehicle.condition}
            onValueChange={(condition) =>
              update('vehicle', { condition: condition as 'new' | 'used' })
            }
          >
            <option value="new">新車</option>
            <option value="used">中古車</option>
          </SelectField>
          <SelectField
            label="車両クラス"
            value={scenario.vehicle.vehicleClass}
            onValueChange={(vehicleClass) =>
              changeVehicleClass(vehicleClass as VehicleClass)
            }
            hint="変更すると維持費の標準値を更新します。"
          >
            <option value="kei">軽自動車</option>
            <option value="s">Sクラス</option>
            <option value="m">Mクラス</option>
            <option value="l">Lクラス</option>
          </SelectField>
          <SelectField
            label="動力"
            value={scenario.vehicle.powertrain}
            onValueChange={(powertrain) =>
              update('vehicle', {
                powertrain: powertrain as Scenario['vehicle']['powertrain'],
              })
            }
          >
            <option value="gasoline">ガソリン</option>
            <option value="e-power">e-POWER</option>
            <option value="e-4orce">e-4ORCE</option>
            <option value="ev">EV</option>
          </SelectField>
          {scenario.vehicle.condition === 'used' && (
            <NumberField
              label="次回車検まで"
              suffix="か月"
              required
              value={scenario.vehicle.nextInspectionMonths}
              onValueChange={(nextInspectionMonths) =>
                update('vehicle', { nextInspectionMonths })
              }
              hint="未入力の場合、車検費用は計算しません。"
            />
          )}
        </FormSection>

        <FormSection
          title="購入・下取金額"
          description={scenario.vehicle.condition === 'used'
            ? '現金一括・クレジットは中古車購入金額を基準に計算します。'
            : '現金一括・クレジットは新車見積総額を基準に計算します。'}
        >
          <div className="vehicle-price-summary">
            <div>
              <span>新車見積総額</span>
              <strong>
                {scenario.vehicle.estimateTotal === ''
                  ? '未入力'
                  : formatYen(result.newVehicleEstimateTotal)}
              </strong>
            </div>
            {result.usedCarPurchasePrice > 0 && (
              <div>
                <span>中古車購入金額</span>
                <strong>{formatYen(result.usedCarPurchasePrice)}</strong>
              </div>
            )}
            <div>
              <span>
                {result.cashCreditPriceBasis === 'used'
                  ? '下取り控除後中古車金額'
                  : '下取り控除後新車金額'}
              </span>
              <strong>
                {scenario.vehicle.estimateTotal === ''
                  || (result.cashCreditPriceBasis === 'used'
                  && result.usedCarPurchasePrice === 0)
                  ? '未入力'
                  : formatYen(result.cashCreditPurchaseAmount)}
              </strong>
            </div>
            <p>
              {result.cashCreditPriceBasis === 'used'
                ? '現金一括・クレジットは中古車価格で試算中'
                : '現金一括・クレジットは新車価格で試算中'}
            </p>
          </div>
          <NumberField
            id="vehicle-estimateTotal"
            label="新車見積総額"
            required
            error={errorFor('vehicle', 'estimateTotal')}
            value={scenario.vehicle.estimateTotal}
            onValueChange={(estimateTotal) => update('vehicle', { estimateTotal })}
          />
          {scenario.vehicle.condition === 'used' && (
            <NumberField
              id="vehicle-usedCarPurchasePrice"
              label="中古車購入価格"
              required
              error={errorFor('vehicle', 'usedCarPurchasePrice')}
              value={scenario.vehicle.usedCarPurchasePrice}
              onValueChange={(usedCarPurchasePrice) =>
                update('vehicle', { usedCarPurchasePrice })
              }
              hint="現金一括・クレジットの試算に使用します。"
            />
          )}
          <NumberField
            label="下取り"
            value={scenario.vehicle.tradeIn}
            onValueChange={(tradeIn) => update('vehicle', { tradeIn })}
            hint={scenario.vehicle.condition === 'used'
              ? '中古車購入価格を上限として控除します。'
              : '新車見積総額を上限として控除します。'}
          />
        </FormSection>

        <FormSection
          title="比較する購入プラン"
          description="商談で比較するプランだけを選択します。オフにしても入力値は保持されます。"
        >
          <Field
            label="比較対象"
            wide
            error={errorFor('vehicle', 'enabledPlans')}
          >
            <div className="plan-toggle-grid">
              {([
                ['cash', '現金一括'],
                ['credit', 'クレジット'],
                ['bvc', 'BVC'],
                ['omatome', 'おまとめプラン'],
              ] as const).map(([planId, label]) => (
                <label className="plan-toggle" key={planId}>
                  <input
                    type="checkbox"
                    checked={scenario.comparison.enabledPlans[planId]}
                    onChange={(event) => updatePlanVisibility(planId, event.target.checked)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </Field>
        </FormSection>

        <FormSection
          id="section-currentCar"
          title="現在の車"
          description="過去の購入額または月の支払額を入力すると比較対象に表示します。"
        >
          <NumberField
            label="過去の購入額"
            value={scenario.currentCar.originalPurchasePrice}
            onValueChange={(originalPurchasePrice) =>
              update('currentCar', { originalPurchasePrice })
            }
          />
          <NumberField
            label="残債"
            value={scenario.currentCar.remainingDebt}
            onValueChange={(remainingDebt) => update('currentCar', { remainingDebt })}
          />
          <NumberField
            label="残りローン回数"
            suffix="回"
            value={scenario.currentCar.remainingPayments}
            onValueChange={(remainingPayments) =>
              update('currentCar', { remainingPayments })
            }
          />
          <NumberField
            label="月の支払額"
            value={scenario.currentCar.monthlyPayment}
            onValueChange={(monthlyPayment) => update('currentCar', { monthlyPayment })}
          />
          <NumberField
            label="維持期間"
            suffix="年"
            min={1}
            max={20}
            required
            value={scenario.currentCar.currentMaintenanceYears}
            onValueChange={(currentMaintenanceYears) =>
              update('currentCar', {
                currentMaintenanceYears: Math.min(
                  20,
                  Math.max(1, Math.round(Number(currentMaintenanceYears) || 1)),
                ),
              })
            }
          />
          <TextField
            id="currentCar-firstRegistrationMonth"
            label="初度登録年月"
            type="month"
            required={statusQuoResult?.isVisible}
            value={scenario.currentCar.firstRegistrationMonth}
            error={errorFor('currentCar', 'firstRegistrationMonth')}
            onValueChange={(firstRegistrationMonth) =>
              update('currentCar', { firstRegistrationMonth })
            }
            hint="現在年月から維持期間分を見て、車検回数を自動計算します。"
          />
          <NumberField
            label="車検費用"
            value={scenario.currentCar.inspectionCost}
            onValueChange={(inspectionCost) =>
              update('currentCar', { inspectionCost })
            }
          />
          <NumberField
            label="法定12か月点検"
            value={scenario.currentCar.legalInspectionCost}
            onValueChange={(legalInspectionCost) =>
              update('currentCar', { legalInspectionCost })
            }
          />
          <NumberField
            label="6か月点検"
            value={scenario.currentCar.sixMonthInspectionCost}
            onValueChange={(sixMonthInspectionCost) =>
              update('currentCar', { sixMonthInspectionCost })
            }
          />
          <NumberField
            label="夏・冬タイヤ"
            value={scenario.currentCar.tireCost}
            onValueChange={(tireCost) => update('currentCar', { tireCost })}
          />
          <NumberField
            label="自動車税"
            value={scenario.currentCar.annualTax}
            onValueChange={(annualTax) => update('currentCar', { annualTax })}
          />
          <NumberField
            label="任意保険"
            suffix="円/月"
            value={scenario.currentCar.monthlyInsurance}
            onValueChange={(monthlyInsurance) =>
              update('currentCar', { monthlyInsurance })
            }
            placeholder="未入力"
          />
          <NumberField
            label="修理費用"
            value={scenario.currentCar.repairCost}
            onValueChange={(repairCost) => update('currentCar', { repairCost })}
            hint="入力した場合のみ、現状維持の維持費へ1回分を反映します。"
          />
        </FormSection>

        {renderPurchaseMaintenanceSection(
          'newMaintenance',
          '新車の維持費条件',
          '新車・BVC・おまとめに反映します。車検と点検が同じ月の場合は重複計上しません。',
        )}

        {scenario.vehicle.condition === 'used' ? renderPurchaseMaintenanceSection(
          'usedMaintenance',
          '中古車の維持費条件',
          '中古車選択時の現金一括・クレジットに反映します。車検と点検が同じ月の場合は重複計上しません。',
        ) : (
          <details className="optional-maintenance" id="section-usedMaintenance">
            <summary>中古車の維持費条件（補助設定）</summary>
            {renderPurchaseMaintenanceSection(
              'usedMaintenance',
              '中古車の維持費条件',
              '中古車へ切り替えた場合の現金一括・クレジットに反映します。',
              false,
            )}
          </details>
        )}

        {scenario.comparison.enabledPlans.cash && <FormSection
          id="section-cash"
          title="現金一括条件"
          description="下取り控除後の車両購入費用と維持費を比較します。"
        >
          <NumberField
            label="維持期間"
            suffix="年"
            min={1}
            max={20}
            required
            value={scenario.cash.cashMaintenanceYears}
            onValueChange={(cashMaintenanceYears) =>
              update('cash', {
                cashMaintenanceYears: Math.min(
                  20,
                  Math.max(1, Math.round(Number(cashMaintenanceYears) || 1)),
                ),
              })
            }
          />
          <div className="calculation-note field--wide">
            {cashResult?.isComplete ? (
              <>
                <strong>一括支払額 {formatYen(cashResult.totalPayment)}</strong>
                <span>
                  月々換算 {formatYen(cashResult.monthlyEquivalent)} / 実質月額{' '}
                  {formatYen(cashResult.effectiveMonthly)} / 実質総額{' '}
                  {formatYen(cashResult.effectiveTotal)}
                </span>
              </>
            ) : (
              <>
                <strong>要入力</strong>
                <span>車両購入価格を入力すると試算結果を表示します。</span>
              </>
            )}
          </div>
        </FormSection>}

        {scenario.comparison.enabledPlans.credit && <FormSection
          id="section-credit"
          title="クレジット条件"
          description={creditManualPayment
            ? '入力した初回・月額・ボーナス加算額から支払総額を計算します。'
            : '車両価格・金利・支払回数から月額を計算します。ボーナス加算は6か月間隔です。'}
        >
          <NumberField
            label="頭金"
            value={scenario.credit.downPayment}
            onValueChange={(downPayment) => update('credit', { downPayment })}
          />
          <NumberField
            label="実質年率"
            suffix="%"
            step="0.1"
            value={scenario.credit.annualRate}
            onValueChange={(annualRate) => update('credit', { annualRate })}
            hint={creditManualPayment
              ? '参考値として保存します。手入力の支払計算には使用しません。'
              : undefined}
          />
          <NumberField
            label="初回支払額"
            value={scenario.credit.firstPayment}
            onValueChange={(firstPayment) => update('credit', { firstPayment })}
            hint="頭金を含まない、初回の月額です。"
          />
          <NumberField
            label="2回目以降月額"
            value={scenario.credit.monthlyPayment}
            onValueChange={(monthlyPayment) => update('credit', { monthlyPayment })}
            hint="ボーナス月加算額を含まない通常月額です。"
          />
          <NumberField
            label="支払回数"
            suffix="回"
            value={scenario.credit.paymentCount}
            onValueChange={(paymentCount) =>
              update('credit', { paymentCount: Number(paymentCount) || 0 })
            }
          />
          <NumberField
            label="ボーナス月加算額"
            value={scenario.credit.bonusPayment}
            onValueChange={(bonusPayment) => update('credit', { bonusPayment })}
          />
          <NumberField
            label="維持期間"
            suffix="年"
            min={1}
            max={20}
            required
            value={scenario.credit.creditMaintenanceYears}
            onValueChange={(creditMaintenanceYears) =>
              update('credit', {
                creditMaintenanceYears: Math.min(
                  20,
                  Math.max(1, Math.round(Number(creditMaintenanceYears) || 1)),
                ),
              })
            }
          />
          <PaymentEntryStatus
            firstPayment={scenario.credit.firstPayment}
            monthlyPayment={scenario.credit.monthlyPayment}
          />
        </FormSection>}

        {scenario.comparison.enabledPlans.bvc && <FormSection
          id="section-bvc"
          title="BVC条件"
          description={bvcManualPayment
            ? '入力した通常支払と残価を分け、返却時と買取時を比較します。'
            : '残価を含む元金全体に利息を反映し、返却時と買取時を比較します。'}
        >
          <NumberField
            label="頭金"
            value={scenario.bvc.downPayment}
            onValueChange={(downPayment) => update('bvc', { downPayment })}
          />
          <NumberField
            label="実質年率"
            suffix="%"
            step="0.1"
            value={scenario.bvc.annualRate}
            onValueChange={(annualRate) => update('bvc', { annualRate })}
            hint={bvcManualPayment
              ? '参考値として保存します。手入力の支払計算には使用しません。'
              : undefined}
          />
          <NumberField
            label="初回支払額"
            value={scenario.bvc.firstPayment}
            onValueChange={(firstPayment) => update('bvc', { firstPayment })}
            hint="頭金を含まない、初回の月額です。"
          />
          <NumberField
            label="2回目以降月額"
            value={scenario.bvc.monthlyPayment}
            onValueChange={(monthlyPayment) => update('bvc', { monthlyPayment })}
            hint="ボーナス月加算額と最終回支払を含まない通常月額です。"
          />
          <SelectField
            label="支払回数"
            value={String(scenario.bvc.paymentCount)}
            onValueChange={(paymentCount) => updateBvcPaymentCount(Number(paymentCount))}
          >
            {BVC_PAYMENT_COUNTS.map((count) => (
              <option value={count} key={count}>{count}回</option>
            ))}
          </SelectField>
          <NumberField
            label="ボーナス月加算額"
            value={scenario.bvc.bonusPayment}
            onValueChange={(bonusPayment) => update('bvc', { bonusPayment })}
          />
          <NumberField
            id="bvc-residualValue"
            label="残価"
            required
            error={errorFor('bvc', 'residualValue')}
            value={scenario.bvc.residualValue}
            onValueChange={(residualValue) => update('bvc', { residualValue })}
          />
          <Field label="比較表の表示">
            <div className="segmented-control">
              <label>
                <input
                  type="radio"
                  name="bvc-mode"
                  checked={scenario.bvc.selectedMode === 'return'}
                  onChange={() => update('bvc', { selectedMode: 'return' })}
                />
                <span>返却時</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="bvc-mode"
                  checked={scenario.bvc.selectedMode === 'purchase'}
                  onChange={() => update('bvc', { selectedMode: 'purchase' })}
                />
                <span>買取時</span>
              </label>
            </div>
          </Field>
          {scenario.bvc.selectedMode === 'return' ? (
            <Field label="維持期間">
              <div className="calculation-note">
                <strong>{paymentCountToYears(scenario.bvc.paymentCount)}年</strong>
                <span>支払期間に連動し、変更できません。</span>
              </div>
            </Field>
          ) : (
            <NumberField
              label="維持期間"
              suffix="年"
              min={paymentCountToYears(scenario.bvc.paymentCount)}
              max={20}
              required
              value={scenario.bvc.bvcMaintenanceYears}
              onValueChange={(bvcMaintenanceYears) =>
                update('bvc', {
                  bvcMaintenanceYears: Math.min(
                    20,
                    Math.max(
                      paymentCountToYears(scenario.bvc.paymentCount),
                      Math.round(Number(bvcMaintenanceYears) || 1),
                    ),
                  ),
                })
              }
              hint={`${paymentCountToYears(scenario.bvc.paymentCount)}〜20年の整数で入力します。`}
            />
          )}
          <PaymentEntryStatus
            firstPayment={scenario.bvc.firstPayment}
            monthlyPayment={scenario.bvc.monthlyPayment}
          />
        </FormSection>}

        {scenario.comparison.enabledPlans.omatome && <FormSection
          id="section-omatome"
          title="おまとめプラン条件"
          description="車検・点検・夏冬タイヤ・自動車税はリース料に含まれます。修理費用は別途負担です。"
        >
          <NumberField
            label="頭金"
            value={scenario.omatome.downPayment}
            onValueChange={(downPayment) => update('omatome', { downPayment })}
          />
          <NumberField
            label="初回支払額"
            value={scenario.omatome.firstPayment}
            onValueChange={(firstPayment) => update('omatome', { firstPayment })}
          />
          <NumberField
            id="omatome-monthlyPayment"
            label="2回目以降月額"
            value={scenario.omatome.monthlyPayment}
            error={errorFor('omatome', 'monthlyPayment')}
            onValueChange={(monthlyPayment) => update('omatome', { monthlyPayment })}
          />
          <SelectField
            label="支払回数"
            value={String(scenario.omatome.paymentCount)}
            onValueChange={(paymentCount) => updateOmatomePaymentCount(Number(paymentCount))}
          >
            {OMATOME_PAYMENT_COUNTS.map((count) => (
              <option value={count} key={count}>{count}回</option>
            ))}
          </SelectField>
          <NumberField
            label="ボーナス月加算額"
            value={scenario.omatome.bonusPayment}
            onValueChange={(bonusPayment) => update('omatome', { bonusPayment })}
          />
          <NumberField
            label="最終回支払"
            value={scenario.omatome.finalPayment}
            onValueChange={(finalPayment) => update('omatome', { finalPayment })}
            hint="通常の支払回数には含みません。返却時は支払総額から除外します。"
          />
          <Field label="比較表の表示">
            <div className="segmented-control">
              <label>
                <input
                  type="radio"
                  name="omatome-mode"
                  checked={scenario.omatome.selectedMode === 'return'}
                  onChange={() => update('omatome', { selectedMode: 'return' })}
                />
                <span>返却時</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="omatome-mode"
                  checked={scenario.omatome.selectedMode === 'purchase'}
                  onChange={() => update('omatome', { selectedMode: 'purchase' })}
                />
                <span>買取時</span>
              </label>
            </div>
          </Field>
          {scenario.omatome.selectedMode === 'return' ? (
            <Field label="維持期間">
              <div className="calculation-note">
                <strong>{paymentCountToYears(scenario.omatome.paymentCount)}年</strong>
                <span>支払期間に連動し、変更できません。</span>
              </div>
            </Field>
          ) : (
            <NumberField
              label="維持期間"
              suffix="年"
              min={paymentCountToYears(scenario.omatome.paymentCount)}
              max={20}
              required
              value={scenario.omatome.omatomeMaintenanceYears}
              onValueChange={(omatomeMaintenanceYears) =>
                update('omatome', {
                  omatomeMaintenanceYears: Math.min(
                    20,
                    Math.max(
                      paymentCountToYears(scenario.omatome.paymentCount),
                      Math.round(Number(omatomeMaintenanceYears) || 1),
                    ),
                  ),
                })
              }
              hint={`${paymentCountToYears(scenario.omatome.paymentCount)}〜20年の整数で入力します。`}
            />
          )}
          <Field label="リース料に含まれる維持費" wide>
            <div className="omatome-included-control">
              <ul>
                <li>車検</li>
                <li>法定12か月点検</li>
                <li>6か月点検</li>
                <li>夏・冬タイヤ</li>
                <li>自動車税</li>
              </ul>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={scenario.omatome.included.insurance}
                  onChange={(event) => updateOmatomeInsurance(event.target.checked)}
                />
                <span>任意保険もリース料に含める</span>
              </label>
              <p>
                選択した支払期間まではリース料込みです。買取後に期間を超えて維持する分と
                修理費用は、別途負担として実質総額へ反映します。
              </p>
            </div>
          </Field>
        </FormSection>}
      </div>
      <QuickResults result={result} />
    </main>
  )
}
