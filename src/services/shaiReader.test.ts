import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { readShaiFile } from './shaiReader'

const xmlFor = (productNumber: string, productName: string) => `<?xml version="1.0" encoding="UTF-8"?>
<declaration>
  <issuerInfo><companyName>発行会社</companyName></issuerInfo>
  <productInfo><productNumber>${productNumber}</productNumber><productName>${productName}</productName></productInfo>
</declaration>`

async function buildShai(entries: Record<string, string>): Promise<File> {
  const zip = new JSZip()
  Object.entries(entries).forEach(([name, content]) => zip.file(name, content))
  const blob = await zip.generateAsync({ type: 'blob' })
  return new File([blob], 'sample.shai')
}

describe('readShaiFile', () => {
  it('XMLから製品名を読み取って品目に持たせる', async () => {
    const file = await buildShai({
      'SHAI_20260724084312_100-132-760_001.xml': xmlFor('100-132-760', 'SGM7J-04AFA6E'),
      'SHAI_20260724084312_100-056-024_002.xml': xmlFor('100-056-024', '減速機ユニット'),
    })
    const loaded = await readShaiFile(file)
    expect(loaded.items.map((item) => [item.productNumber, item.productName])).toEqual([
      ['100-132-760', 'SGM7J-04AFA6E'],
      ['100-056-024', '減速機ユニット'],
    ])
  })

  it('製品名を取得できないXMLでも読み込みは成功する', async () => {
    const file = await buildShai({
      'SHAI_20260724084312_100-132-760_001.xml': '<declaration><productInfo><productNumber>100-132-760</productNumber></productInfo></declaration>',
    })
    const loaded = await readShaiFile(file)
    expect(loaded.items[0].productName).toBeUndefined()
  })
})
