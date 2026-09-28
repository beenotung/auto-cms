import { expect } from 'chai'
import { extractWrappedText, resolveLang } from './i18n'

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

describe('resolveLang()', () => {
  it('should accept exact supported codes', () => {
    expect(resolveLang('en')).to.equal('en')
    expect(resolveLang('zh_hk')).to.equal('zh_hk')
    expect(resolveLang('zh_cn')).to.equal('zh_cn')
  })
  it('should normalize region and script variants', () => {
    expect(resolveLang('en-US')).to.equal('en')
    expect(resolveLang('en-GB')).to.equal('en')
    expect(resolveLang('EN_us')).to.equal('en')
    expect(resolveLang('zh-Hant')).to.equal('zh_hk')
    expect(resolveLang('zh-Hans')).to.equal('zh_cn')
    expect(resolveLang('zh-CN')).to.equal('zh_cn')
    expect(resolveLang('zh-TW')).to.equal('zh_hk')
    expect(resolveLang('ja-JP')).to.equal('ja')
  })
  it('should return null when no language can be inferred', () => {
    expect(resolveLang('de-DE')).to.equal(null)
    expect(resolveLang('fr')).to.equal(null)
    expect(resolveLang('english')).to.equal(null)
    expect(resolveLang('')).to.equal(null)
    expect(resolveLang(undefined)).to.equal(null)
    expect(resolveLang(['en'])).to.equal(null)
  })
})
