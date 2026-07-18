import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { NumberField } from './FormControls'

function MoneyFieldHarness() {
  const [value, setValue] = useState<number | ''>(1234567)
  return (
    <NumberField
      id="price"
      label="車両価格"
      value={value}
      onValueChange={setValue}
    />
  )
}

describe('NumberField', () => {
  it('formats money with separators outside focus and keeps numeric state', async () => {
    const user = userEvent.setup()
    render(<MoneyFieldHarness />)
    const input = screen.getByRole('textbox', { name: '車両価格' })

    expect(input).toHaveValue('1,234,567')
    await user.click(input)
    expect(input).toHaveValue('1234567')
    await user.clear(input)
    await user.type(input, '2800000')
    await user.tab()
    expect(input).toHaveValue('2,800,000')
  })
})
