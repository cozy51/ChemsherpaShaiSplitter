import { describe, expect, it } from 'vitest'
import { sanitizeFileBaseName } from './fileNameSanitizer'

describe('sanitizeFileBaseName', () => {
  it('そのまま使える製品名は変更しない', () => {
    expect(sanitizeFileBaseName('SGM7J-04AFA6E')).toBe('SGM7J-04AFA6E')
  })

  it('ファイル名に使えない文字を置き換える', () => {
    expect(sanitizeFileBaseName('A/B:C*D?E"F<G>H|I')).toBe('A_B_C_D_E_F_G_H_I')
  })

  it('前後の空白と末尾のピリオドを取り除く', () => {
    expect(sanitizeFileBaseName('  ブラケット組立.  ')).toBe('ブラケット組立')
  })

  it('長すぎる名前を100文字に収める', () => {
    expect(sanitizeFileBaseName('あ'.repeat(150))).toBe('あ'.repeat(100))
  })

  it('Windowsの予約名を避ける', () => {
    expect(sanitizeFileBaseName('CON')).toBe('_CON')
  })

  it.each([undefined, '', '   ', '///'])('使える文字が残らない場合はundefinedを返す: %s', (value) => {
    expect(sanitizeFileBaseName(value)).toBeUndefined()
  })
})
