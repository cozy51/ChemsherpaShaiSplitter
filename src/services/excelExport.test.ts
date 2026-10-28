import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { createExcel, excelFileNameOf, summarizeItem } from './excelExport'

const encoder = new TextEncoder()
const xml = (contact: string) => `<?xml version="1.0" encoding="utf-8"?>
<Main xmlns="http://std.iec.ch/iec62474" schemaDatabaseVersion="X8.00ex1.0" charaLocal="JPN" declarationComplete="true">
  <Include><Sectional nameOfSectional="Compliance" /></Include>
  <BusinessInfo mode="Distribution">
    <Response date="2026-07-22" docID="26-117" comment="2026-07-22">
      <Authorizer division="Production Engineering Dept" name="Yutaka.Musya" title="Deputy Section Manager" email="yutaka@example.com" phone="04-2966-1316" nameLocal="武者　豊" />
      <Contact ${contact} />
      <SupplyCompany name="YASKAWA Electric Corporation" nameLocal="株式会社　安川電機" />
    </Response>
  </BusinessInfo>
  <Product unitType="each" isArticle="true">
    <ProductID name="SGMPS-04ACA-SD11 MOTOR 17INC,24V,ROHS" identifier="100-056-024" effectiveDate="2026-07-23" version="Y001"><Mass mass="2400" unitOfMeasure="g" /></ProductID>
    <Compliance>
      <DeclarableSubstanceList identity="LR04" authority="IEC62474" version="D32.00" />
      <DsDsg name="Lead dinitrate"><DsDsgID entryIdentity="00089" /></DsDsg>
    </Compliance>
  </Product>
</Main>`
const fullContact = 'division="Production Engineering Dept." name="Satoshi.Terasaki" title="Production Engineering Dept." email="s@example.com" phone="04-2966-1316" postalCode="358-8555" nameLocal="寺崎　智"'
const item = (contact = fullContact) => ({ id: 'a', productNumber: '100-056-024', productName: 'SGMPS-04ACA-SD11 MOTOR 17INC,24V,ROHS', xmlFileName: 'SHAI_20260724084312_100-056-024_001.xml', data: encoder.encode(xml(contact)) })

describe('summarizeItem', () => {
  it('製品情報・発行者・承認者・伝達事項を取り出す', () => {
    const summary = summarizeItem(item())
    expect(summary.product.slice(0, 6)).toEqual(['SGMPS-04ACA-SD11 MOTOR 17INC,24V,ROHS', '100-056-024', '2400', 'g', '', '個'])
    expect(summary.issuer[0]).toEqual({ label: '会社名', english: 'YASKAWA Electric Corporation', local: '株式会社　安川電機', required: true })
    expect(summary.issuer.find((row) => row.label === '氏名')).toMatchObject({ english: 'Satoshi.Terasaki', local: '寺崎　智' })
    expect(summary.response).toEqual({ date: '2026-07-22', docID: '26-117', comment: '2026-07-22' })
    expect(summary.sectionals).toEqual(['遵法判断情報'])
    expect(summary.missing).toEqual([])
  })

  it('必須項目の未入力を見つける', () => {
    expect(summarizeItem(item('name="Satoshi.Terasaki"')).missing).toEqual(['発行者 部署名', '発行者 役職', '発行者 e-mailアドレス', '発行者 電話番号'])
  })

  it('遵法判断情報の管理対象基準コードを名称に置き換える', () => {
    const rows = summarizeItem(item()).compliance
    expect(rows.map((row) => [row.depth, row.element])).toEqual([[0, 'DeclarableSubstanceList'], [0, 'DsDsg'], [1, 'DsDsgID']])
    expect(rows[0].regulation).toBe('LR04 EU-RoHS (EU) RoHS指令 Annex II')
  })
})

describe('createExcel', () => {
  it('製品情報・発行者・承認者・遵法判断情報・全項目・管理対象基準のシートを作る', async () => {
    const blob = await createExcel([item(), { ...item('name="Satoshi.Terasaki"'), id: 'b' }], 'SHAI_26-117.shai')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await blob.arrayBuffer())
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['製品情報', '発行者・承認者', '遵法判断情報', '全項目', '管理対象基準'])
    const products = workbook.getWorksheet('製品情報')!
    expect(products.getCell('B5').value).toBe('SGMPS-04ACA-SD11 MOTOR 17INC,24V,ROHS')
    expect(String(products.getRow(5).getCell(14).value)).toBe('○ すべて入力済み')
    expect(String(products.getRow(6).getCell(14).value)).toContain('× 未入力 4件')
    // 発行者が異なるため、品目ごとに2つの表に分かれる
    const party = workbook.getWorksheet('発行者・承認者')!
    const targets: string[] = []
    party.eachRow((row) => { const value = String(row.getCell(1).value ?? ''); if (value.startsWith('対象:')) targets.push(value) })
    expect(targets).toEqual(['対象: 100-056-024', '対象: 100-056-024'])
    expect(workbook.getWorksheet('全項目')!.rowCount).toBeGreaterThan(20)
  })

  it('.shai のファイル名から .xlsx のファイル名を作る', () => {
    expect(excelFileNameOf('SGMPS-04ACA.shai')).toBe('SGMPS-04ACA.xlsx')
  })
})
