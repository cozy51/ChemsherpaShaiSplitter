import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildXmlView, inspectSplitFile } from './xmlViewer'
import { createSplitFiles } from './shaiWriter'

const encoder = new TextEncoder()
const xml = `<?xml version="1.0" encoding="utf-8"?>
<Main xmlns="http://std.iec.ch/iec62474"><Product unitType="each"><ProductID name="SGMPS-04ACA" identifier="100-056-024" /><Note>備考</Note><Note>2行目</Note></Product></Main>`
const item = { id: 'a', productNumber: '100-056-024', productName: 'SGMPS-04ACA', xmlFileName: 'SHAI_20260724084312_100-056-024_001.xml', data: encoder.encode(xml) }

describe('buildXmlView', () => {
  it('属性と値を項目一覧にし、同名要素には番号を付ける', () => {
    const view = buildXmlView(item.data)
    expect(view.parseError).toBe(false)
    expect(view.fields).toEqual([
      { path: 'Main', name: '@xmlns', value: 'http://std.iec.ch/iec62474' },
      { path: 'Main/Product', name: '@unitType', value: 'each' },
      { path: 'Main/Product/ProductID', name: '@name', value: 'SGMPS-04ACA' },
      { path: 'Main/Product/ProductID', name: '@identifier', value: '100-056-024' },
      { path: 'Main/Product/Note[1]', name: '(値)', value: '備考' },
      { path: 'Main/Product/Note[2]', name: '(値)', value: '2行目' },
    ])
  })

  it('XMLソースを字下げして整形する', () => {
    expect(buildXmlView(item.data).source).toContain('\n    <ProductID name="SGMPS-04ACA" identifier="100-056-024" />')
  })

  it('壊れたXMLでもソースは表示できる', () => {
    const view = buildXmlView(encoder.encode('<root><unclosed>'))
    expect(view).toMatchObject({ parseError: true, source: '<root><unclosed>', fields: [] })
  })
})

describe('inspectSplitFile', () => {
  it('分割後のSHAIが分割前と一致することを確認する', async () => {
    const [file] = await createSplitFiles([item])
    const inspection = await inspectSplitFile(file.blob, item)
    expect(inspection.entries).toEqual([item.xmlFileName])
    expect(inspection.checks.every((check) => check.ok)).toBe(true)
    expect(inspection.checks.map((check) => check.label)).toEqual(['格納ファイル', 'XMLデータ', 'XML構文', '項目と値', '製品品番'])
  })

  it('内容が異なる場合は不一致として報告する', async () => {
    const zip = new JSZip()
    zip.file(item.xmlFileName, xml.replace('SGMPS-04ACA"', 'CHANGED"'))
    zip.file('extra.xml', '<a/>')
    const inspection = await inspectSplitFile(await zip.generateAsync({ type: 'blob' }), item)
    const failed = inspection.checks.filter((check) => !check.ok).map((check) => check.label)
    expect(failed).toEqual(['格納ファイル', 'XMLデータ', '項目と値'])
  })
})
