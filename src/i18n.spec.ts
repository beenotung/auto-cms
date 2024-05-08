import { expect } from 'chai'
import { extractWrappedText } from './i18n'

function test(input: string, output: string[]) {
  expect(extractWrappedText(input)).to.deep.equals(output)
}

describe('extractWrappedText()', () => {
  it('should extract in single-line', () => {
    test('{{Happy Customer.}}', ['{{Happy Customer.}}'])
  })
  it('should extract in multi-line', () => {
    test('{{Happy\nCustomer.}}', ['{{Happy\nCustomer.}}'])
  })
})
