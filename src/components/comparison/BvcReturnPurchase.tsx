/**
 * BVC 返却 / 買取 の比較表示。
 * 残価が最終回に据え置かれること、返却と買取の差が残価相当であることを示す。
 */

import type { Scenario } from '../../domain/types'
import { calculateBvcBoth, calcVehicleEstimate } from '../../domain/scenario'
import { calculateMaintenance } from '../../domain/maintenance'
import { formatYen } from '../../utils/format'

export function BvcReturnPurchase({ scenario }: { scenario: Scenario }) {
  const estimate = calcVehicleEstimate(scenario)
  const years = scenario.maintenance.simulationYears
  const maintenance = calculateMaintenance(scenario.maintenance, {
    vehicleMode: scenario.vehicleMode,
    years,
  })
  const both = calculateBvcBoth(scenario, {
    estimate,
    maintenance,
    comparisonMonths: years * 12,
  })

  if (both.purchase.residualValue <= 0) {
    return (
      <p className="bvc__note">
        BVCの残価が未設定です。残価を入力すると、返却時と買取時の比較が表示されます。
      </p>
    )
  }

  return (
    <div className="bvc">
      <table className="bvc__table">
        <thead>
          <tr>
            <th scope="col">項目</th>
            <th scope="col">返却時</th>
            <th scope="col">買取時</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">月々の支払</th>
            <td>{formatYen(both.return.monthlyPayment)}</td>
            <td>{formatYen(both.purchase.monthlyPayment)}</td>
          </tr>
          <tr>
            <th scope="row">最終回の支払（残価）</th>
            <td>—（返却のため発生しません）</td>
            <td>{formatYen(both.purchase.finalPayment)}</td>
          </tr>
          <tr>
            <th scope="row">支払総額</th>
            <td>{formatYen(both.return.totalPayment)}</td>
            <td>{formatYen(both.purchase.totalPayment)}</td>
          </tr>
        </tbody>
      </table>
      <p className="bvc__note">
        返却時と買取時の支払総額の差は <strong>{formatYen(both.residualDiff)}</strong>{' '}
        で、これは据え置かれた残価に相当します。月額だけでなく最終回の残価も含めてご確認ください。
      </p>
    </div>
  )
}
