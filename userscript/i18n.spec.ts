import { expect } from 'chai'
import { wrapText } from './i18n'

function test(input: string, output: string | false) {
  expect(wrapText(input)).to.equal(output)
}

describe('wrapText()', () => {
  it('should detect english phrase', () => {
    test('Happy Customers', '{{Happy Customers}}')
  })
  it('should include full stop', () => {
    test('Happy Customers.', '{{Happy Customers.}}')
  })
  it('should include numbers in the middle', () => {
    test(
      'Announcing our $2M Seed funding.',
      '{{Announcing our $2M Seed funding.}}',
    )
  })
  it('should skip number-only text', () => {
    test('500', false)
  })
  it('should skip number-only and symbol-only text', () => {
    test('500+', false)
  })
  it('should include numbers and symbols if the phrase as english char', () => {
    test('$2M+', '{{$2M+}}')
  })
  it('should include tailing number', () => {
    test('YOLOv9', '{{YOLOv9}}')
  })
  it('should not include leading/tailing spaces', () => {
    test(' apple ', ' {{apple}} ')
    test(' $2M+ ', ' {{$2M+}} ')
  })
})
