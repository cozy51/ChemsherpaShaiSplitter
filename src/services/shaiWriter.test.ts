import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { createBundle, createSplitFiles } from './shaiWriter'

const encoder = new TextEncoder()
const items = [
  { id: 'a', productNumber: '100-056-024', xmlFileName: 'SHAI_20260724084312_100-056-024_001.xml', data: encoder.encode('<a>original</a>') },
  { id: 'b', productNumber: '100-056-024', xmlFileName: 'SHAI_20260724084312_100-056-024_002.xml', data: encoder.encode('<b>original</b>') },
]

describe('SHAl生成', () => {
  it('XMLを変更せずZIP直下に1つだけ格納し、重複名を回避する', async () => {
    const results = await createSplitFiles(items)
    expect(results.map((file) => file.fileName)).toEqual(['100-056-024.shai', '100-056-024_2.shai'])
    const zip = await JSZip.loadAsync(await results[0].blob.arrayBuffer())
    expect(Object.keys(zip.files)).toEqual([items[0].xmlFileName])
    expect(await zip.file(items[0].xmlFileName)!.async('string')).toBe('<a>original</a>')
  })

  it('分割SHAlをまとめたZIPを生成する', async () => {
    const results = await createSplitFiles(items)
    const bundle = await JSZip.loadAsync(await (await createBundle(results)).arrayBuffer())
    expect(Object.keys(bundle.files)).toEqual(['100-056-024.shai', '100-056-024_2.shai'])
  })
})
