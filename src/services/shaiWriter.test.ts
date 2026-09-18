import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { createBundle, createSplitFiles } from './shaiWriter'

const encoder = new TextEncoder()
const items = [
  { id: 'a', productNumber: '100-056-024', productName: 'SGM7J-04AFA6E', xmlFileName: 'SHAI_20260724084312_100-056-024_001.xml', data: encoder.encode('<a>original</a>') },
  { id: 'b', productNumber: '100-056-024', productName: 'SGM7J-04AFA6E', xmlFileName: 'SHAI_20260724084312_100-056-024_002.xml', data: encoder.encode('<b>original</b>') },
]

describe('SHAl生成', () => {
  it('製品名をファイル名にし、XMLを変更せずZIP直下に1つだけ格納する', async () => {
    const results = await createSplitFiles(items)
    expect(results.map((file) => file.fileName)).toEqual(['SGM7J-04AFA6E.shai', 'SGM7J-04AFA6E_2.shai'])
    const zip = await JSZip.loadAsync(await results[0].blob.arrayBuffer())
    expect(Object.keys(zip.files)).toEqual([items[0].xmlFileName])
    expect(await zip.file(items[0].xmlFileName)!.async('string')).toBe('<a>original</a>')
  })

  it('製品名が無い場合は製品品番をファイル名に使う', async () => {
    const results = await createSplitFiles([{ ...items[0], productName: undefined }])
    expect(results.map((file) => file.fileName)).toEqual(['100-056-024.shai'])
  })

  it('ファイル名に使えない文字を含む製品名を安全な名前に整える', async () => {
    const results = await createSplitFiles([{ ...items[0], productName: 'ユニット/A:1' }])
    expect(results.map((file) => file.fileName)).toEqual(['ユニット_A_1.shai'])
  })

  it('大文字小文字だけが異なる製品名も重複として扱う', async () => {
    const results = await createSplitFiles([items[0], { ...items[1], productName: 'sgm7j-04afa6e' }])
    expect(results.map((file) => file.fileName)).toEqual(['SGM7J-04AFA6E.shai', 'sgm7j-04afa6e_2.shai'])
  })

  it('分割SHAlをまとめたZIPを生成する', async () => {
    const results = await createSplitFiles(items)
    const bundle = await JSZip.loadAsync(await (await createBundle(results)).arrayBuffer())
    expect(Object.keys(bundle.files)).toEqual(['SGM7J-04AFA6E.shai', 'SGM7J-04AFA6E_2.shai'])
  })
})
