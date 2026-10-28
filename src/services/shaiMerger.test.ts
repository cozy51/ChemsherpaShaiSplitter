import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { defaultMergedName, excludeDuplicates, mergeShaiItems, mergedFileNameOf } from './shaiMerger'

const encoder = new TextEncoder()
const itemOf = (xmlFileName: string, content: string) => ({ id: xmlFileName + content, productNumber: 'x', xmlFileName, data: encoder.encode(content) })

async function namesIn(blob: Blob) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  return Object.keys(zip.files)
}

describe('mergeShaiItems', () => {
  it('複数のXMLを変更せずZIP直下にまとめる', async () => {
    const result = await mergeShaiItems([
      itemOf('SHAI_20260724084312_100-056-024_001.xml', '<a/>'),
      itemOf('SHAI_20260801120000_100-060-919_001.xml', '<b/>'),
    ])
    expect(await namesIn(result.blob)).toEqual(['SHAI_20260724084312_100-056-024_001.xml', 'SHAI_20260801120000_100-060-919_001.xml'])
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer())
    expect(await zip.file('SHAI_20260801120000_100-060-919_001.xml')!.async('string')).toBe('<b/>')
    expect(result.warnings).toEqual([])
  })

  it('同じ名前・同じ内容のXMLは1つだけ入れる', async () => {
    const result = await mergeShaiItems([itemOf('SHAI_20260724084312_100-056-024_001.xml', '<a/>'), itemOf('SHAI_20260724084312_100-056-024_001.xml', '<a/>')])
    expect(result.xmlFileNames).toEqual(['SHAI_20260724084312_100-056-024_001.xml'])
    expect(result.warnings).toHaveLength(1)
  })

  it('同じ名前で内容が異なるXMLは連番を付け替えて入れる', async () => {
    const result = await mergeShaiItems([
      itemOf('SHAI_20260724084312_100-056-024_001.xml', '<a/>'),
      itemOf('SHAI_20260724084312_100-056-024_002.xml', '<b/>'),
      itemOf('SHAI_20260724084312_100-056-024_001.xml', '<c/>'),
    ])
    expect(result.xmlFileNames).toEqual([
      'SHAI_20260724084312_100-056-024_001.xml',
      'SHAI_20260724084312_100-056-024_002.xml',
      'SHAI_20260724084312_100-056-024_003.xml',
    ])
    expect(result.warnings[0]).toContain('SHAI_20260724084312_100-056-024_003.xml')
  })
})

describe('結合ファイル名', () => {
  it('入力を安全な .shai のファイル名にする', () => {
    expect(mergedFileNameOf('結合/テスト')).toBe('結合_テスト.shai')
    expect(mergedFileNameOf('sample.shai')).toBe('sample.shai')
    expect(mergedFileNameOf('  ')).toBe('SHAI_merged.shai')
  })

  it('初期値は日時入りの名前にする', () => {
    expect(defaultMergedName(new Date(2026, 9, 28, 9, 5, 7))).toBe('SHAI_merged_20261028090507')
  })
})

describe('excludeDuplicates', () => {
  const withNumber = (productNumber: string, content: string) => ({ ...itemOf(`SHAI_20260724084312_${productNumber}_001.xml`, content), productNumber })

  it('すでにある製品品番の品目は追加しない', () => {
    const existing = [withNumber('100-056-024', '<a/>')]
    const { accepted, skipped } = excludeDuplicates(existing, [withNumber('100-056-024', '<a/>'), withNumber('100-056-024', '<changed/>'), withNumber('100-060-919', '<b/>')])
    expect(accepted.map((item) => item.productNumber)).toEqual(['100-060-919'])
    expect(skipped.map((entry) => [entry.item.productNumber, entry.identical])).toEqual([['100-056-024', true], ['100-056-024', false]])
  })

  it('同じファイル内で製品品番が重なる場合は先の品目だけを残す', () => {
    const { accepted, skipped } = excludeDuplicates([], [withNumber('100-056-024', '<a/>'), withNumber('100-056-024', '<a/>')])
    expect(accepted).toHaveLength(1)
    expect(skipped).toHaveLength(1)
  })
})
