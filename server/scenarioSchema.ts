import type { Scenario } from '../src/domain/types.js'
import {
  BVC_PAYMENT_COUNTS,
  OMATOME_PAYMENT_COUNTS,
  paymentCountToYears,
} from '../src/domain/planTerms.js'

const money = (value: unknown) =>
  value === '' || (typeof value === 'number' && Number.isFinite(value) && value >= 0)
const text = (value: unknown, max = 200) =>
  typeof value === 'string' && value.length <= max
const integer = (value: unknown, min: number, max: number) =>
  typeof value === 'number'
  && Number.isInteger(value)
  && value >= min
  && value <= max
const registrationMonth = (value: unknown) => {
  if (value === '') return true
  if (typeof value !== 'string') return false
  const match = value.match(/^(\d{4})-(\d{2})$/)
  if (!match) return false
  const month = Number(match[2])
  return month >= 1 && month <= 12
}

export function isValidScenario(value: unknown): value is Scenario {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const scenario = value as Scenario
  const {
    comparison,
    quote,
    vehicle,
    currentCar,
    newMaintenance,
    usedMaintenance,
    cash,
    credit,
    bvc,
    omatome,
  } = scenario
  if ([comparison, quote, vehicle, currentCar, newMaintenance, usedMaintenance, cash, credit, bvc, omatome]
    .some((section) => !section || typeof section !== 'object' || Array.isArray(section))) {
    return false
  }
  const validParts = (m: Scenario['newMaintenance'] | Scenario['currentCar']) =>
    (m.inspectionServiceCost === undefined || money(m.inspectionServiceCost))
    && (m.inspectionLegalCost === undefined || money(m.inspectionLegalCost))
    && (m.pricingSource === undefined || (m.pricingSource && typeof m.pricingSource === 'object'
      && text(m.pricingSource.model) && text(m.pricingSource.masterVersion) && text(m.pricingSource.codes)
      && text(m.pricingSource.appliedAt,40) && text(m.pricingSource.detail,100000)))
  const validMaintenance = (maintenance: Scenario['newMaintenance']) =>
    [maintenance.inspectionCost, maintenance.legalInspectionCost,
      maintenance.sixMonthInspectionCost, maintenance.tireCost,
      maintenance.annualTax, maintenance.monthlyInsurance,
      maintenance.repairCost].every(money)
    && integer(maintenance.tireCycleYears, 1, 20)
    && typeof maintenance.includeInsurance === 'boolean'

  const enabledPlans = comparison.enabledPlans
  const validEnabledPlans = Boolean(enabledPlans)
    && typeof enabledPlans === 'object'
    && !Array.isArray(enabledPlans)
    && Object.keys(enabledPlans).length === 4
    && ['cash', 'credit', 'bvc', 'omatome']
      .every((planId) => typeof enabledPlans[planId as keyof typeof enabledPlans] === 'boolean')

  const link = scenario.customerLink
  const validLink = link === undefined || (link && typeof link === 'object' && !Array.isArray(link)
    && ['customerId', 'vehicleId', 'customerName', 'vehicleName', 'numberLast4', 'firstRegistrationMonth', 'capturedAt'].every(k => text(link[k as keyof typeof link], 200))
    && link.customerId.length > 0 && link.vehicleId.length > 0
    && registrationMonth(link.firstRegistrationMonth) && /^\d{0,4}$/.test(link.numberLast4)
    && Number.isFinite(Date.parse(link.capturedAt)))
  const source = scenario.templateSource
  const validSource = source === undefined || (source && typeof source === 'object' && !Array.isArray(source)
    && text(source.id) && text(source.name) && text(source.updatedAt, 40) && Number.isFinite(Date.parse(source.updatedAt)))
  return validLink && validSource
    && (scenario.strictInput === undefined || typeof scenario.strictInput === 'boolean')
    && (quote.drive === undefined || text(quote.drive, 100))
    && (quote.amountStatus === undefined || ['unreviewed', 'estimate', 'confirmed'].includes(quote.amountStatus))
    && scenario.schemaVersion === 11
    && validEnabledPlans
    && text(quote.scenarioName, 120)
    && text(quote.quoteDate, 20)
    && text(quote.staffName)
    && text(quote.customerName)
    && text(quote.carName)
    && text(quote.grade)
    && [vehicle.estimateTotal, vehicle.usedCarPurchasePrice, vehicle.tradeIn].every(money)
    && ['new', 'used'].includes(vehicle.condition)
    && ['kei', 's', 'm', 'l'].includes(vehicle.vehicleClass)
    && ['gasoline', 'e-power', 'e-4orce', 'ev'].includes(vehicle.powertrain)
    && (vehicle.nextInspectionMonths === '' || integer(vehicle.nextInspectionMonths, 0, 240))
    && integer(currentCar.currentMaintenanceYears, 1, 20)
    && [currentCar.originalPurchasePrice, currentCar.remainingDebt, currentCar.monthlyPayment,
      currentCar.inspectionCost, currentCar.legalInspectionCost, currentCar.sixMonthInspectionCost,
      currentCar.tireCost, currentCar.annualTax, currentCar.monthlyInsurance,
      currentCar.repairCost].every(money)
    && registrationMonth(currentCar.firstRegistrationMonth)
    && (currentCar.nextInspectionMonth === undefined || registrationMonth(currentCar.nextInspectionMonth))
    && (currentCar.remainingPayments === '' || integer(currentCar.remainingPayments, 0, 240))
    && (currentCar.tireCycleYears === '' || integer(currentCar.tireCycleYears, 1, 20))
    && validParts(currentCar) && validParts(newMaintenance) && validParts(usedMaintenance)
    && validMaintenance(newMaintenance)
    && validMaintenance(usedMaintenance)
    && integer(cash.cashMaintenanceYears, 1, 20)
    && integer(credit.creditMaintenanceYears, 1, 20)
    && [credit.downPayment, credit.firstPayment, credit.monthlyPayment].every(money)
    && money(credit.annualRate)
    && integer(credit.paymentCount, 1, 240)
    && money(credit.bonusPayment)
    && integer(bvc.bvcMaintenanceYears, paymentCountToYears(bvc.paymentCount), 20)
    && [bvc.downPayment, bvc.firstPayment, bvc.monthlyPayment].every(money)
    && money(bvc.annualRate)
    && BVC_PAYMENT_COUNTS.includes(bvc.paymentCount as typeof BVC_PAYMENT_COUNTS[number])
    && money(bvc.bonusPayment)
    && money(bvc.residualValue)
    && ['return', 'purchase'].includes(bvc.selectedMode)
    && integer(omatome.omatomeMaintenanceYears, paymentCountToYears(omatome.paymentCount), 20)
    && [omatome.downPayment, omatome.firstPayment, omatome.monthlyPayment,
      omatome.bonusPayment, omatome.finalPayment].every(money)
    && OMATOME_PAYMENT_COUNTS.includes(
      omatome.paymentCount as typeof OMATOME_PAYMENT_COUNTS[number],
    )
    && ['return', 'purchase'].includes(omatome.selectedMode)
    && Boolean(omatome.included)
    && typeof omatome.included === 'object'
    && Object.keys(omatome.included).length === 6
    && Object.values(omatome.included).every((included) => typeof included === 'boolean')
    && omatome.included.inspection === true
    && omatome.included.legalInspection === true
    && omatome.included.sixMonthInspection === true
    && omatome.included.tires === true
    && omatome.included.tax === true
}
