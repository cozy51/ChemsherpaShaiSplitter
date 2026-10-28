import type { Worksheet } from 'exceljs'
import type { ShaiItem } from '../types'
import { parseDocument } from './xmlParser'
import { buildXmlView } from './xmlViewer'

/** 製品情報シートの1列分の定義です。chemSHERPA-AIの要素名・属性名から値を取り出します。 */
interface ProductSpec {
  label: string
  element: string
  attribute: string
  required?: boolean
  width: number
  /** 値を表示用に言い換えます（例: each → 個）。 */
  format?: (value: string) => string
}

/** 発行者・承認者シートの1行分の定義です。英語と日本語の属性を組にして持ちます。 */
interface PartySpec {
  label: string
  attribute: string
  localAttribute?: string
  /** chemSHERPA-AIツールの画面と同じく、必須は英語のみです。 */
  required?: boolean
}

const UNIT_TYPES: Record<string, string> = { each: '個', meter: 'm', kilogram: 'kg', squareMeter: 'm²', liter: 'L' }
const SECTIONALS: Record<string, string> = { Compliance: '遵法判断情報', Composition: '成分情報', FMD: '全成分(FMD)' }
const BOOLEANS: Record<string, string> = { true: 'はい', false: 'いいえ' }

/** chemSHERPA-AI（作成支援）ツールの「製品・部品情報」に合わせた列です。* の付く項目を必須としています。 */
export const PRODUCT_SPECS: ProductSpec[] = [
  { label: '製品名', element: 'ProductID', attribute: 'name', required: true, width: 36 },
  { label: '製品品番', element: 'ProductID', attribute: 'identifier', required: true, width: 16 },
  { label: '質量', element: 'Mass', attribute: 'mass', required: true, width: 12 },
  { label: '質量単位', element: 'Mass', attribute: 'unitOfMeasure', required: true, width: 9 },
  { label: 'シリーズ品名', element: 'Product', attribute: 'productFamilyName', width: 16 },
  { label: '報告単位', element: 'Product', attribute: 'unitType', required: true, width: 9, format: (value) => UNIT_TYPES[value] ?? value },
  { label: '版数', element: 'ProductID', attribute: 'version', width: 9 },
  { label: '発効日', element: 'ProductID', attribute: 'effectiveDate', width: 12 },
  { label: '依頼者側の製品名', element: 'ProductID', attribute: 'requesterName', width: 18 },
  { label: '依頼者側の製品品番', element: 'ProductID', attribute: 'requesterIdentifier', width: 18 },
  { label: '成形品', element: 'Product', attribute: 'isArticle', width: 8, format: (value) => BOOLEANS[value] ?? value },
]

/** chemSHERPA-AI（作成支援）ツールの「発行者・承認者情報画面」に合わせた行です。 */
export const PARTY_SPECS: PartySpec[] = [
  { label: '部署名', attribute: 'division', localAttribute: 'divisionLocal', required: true },
  { label: '役職', attribute: 'title', localAttribute: 'titleLocal', required: true },
  { label: '氏名', attribute: 'name', localAttribute: 'nameLocal', required: true },
  { label: 'e-mailアドレス', attribute: 'email', required: true },
  { label: '電話番号', attribute: 'phone', required: true },
  { label: '内線番号', attribute: 'internalAddress' },
  { label: '郵便番号', attribute: 'postalCode' },
  { label: '国または地域', attribute: 'country' },
  { label: '都道府県', attribute: 'stateProvince', localAttribute: 'stateProvinceLocal' },
  { label: '市町村', attribute: 'city', localAttribute: 'cityLocal' },
  { label: '番地', attribute: 'street', localAttribute: 'streetLocal' },
]

/** chemSHERPA-AIツールの「管理対象基準/候補物質の詳細」（物質リストバージョン 2.13.00）の一覧です。 */
export const REGULATIONS: [code: string, name: string, description: string, revision: string][] = [
  ['LR01', 'CSCL', '(日本) 化審法　第一種特定化学物質', '2024-12-18'],
  ['LR02', 'TSCA', '(米国) 有害物質規制法（TSCA）　使用禁止または制限物質（第6条）', '40 CFR 763'],
  ['LR03', 'ELV', '(EU) ELV指令', '2000/53/EC'],
  ['LR04', 'EU-RoHS', '(EU) RoHS指令 Annex II', '(EU) 2015/863'],
  ['LR05', 'POPs', '(EU) POPs規則 Annex I', '(EU) 2025/1930'],
  ['LR06', 'SVHC', '(EU) REACH規則 Candidate List of SVHC for Authorisation（認可対象候補物質）およびAnnex XIV', 'C:2026-02-04, A:(EU) 2022/586'],
  ['LR07', 'REACH Annex XVII', '(EU) REACH規則 Annex XVII（制限対象物質）', '(EU) 2025/1988'],
  ['LR08', 'MDR', '(EU) 医療機器規則（MDR）Annex I 10.4 化学物質', 'CLP:(EU) 2025/1222, SVHC:2026-02-04'],
  ['LR09', 'China-RoHS', '(中国) 電器電子製品有害物質使用制限管理弁法', '2016-07-01, GB 26572-2025'],
  ['IC01', 'GADSL', 'Global Automotive Declarable Substance List (GADSL)', '2025 GADSL Reference List Version 1.1'],
  ['IC02', 'IEC62474', 'IEC 62474 DB Declarable substance groups and declarable substances', 'IEC62474 D32.00'],
  ['CD01', 'CDS', '管理対象候補物質', '-'],
]

/** 全項目シートで属性名に添える日本語の説明です。 */
const ATTRIBUTE_LABELS: Record<string, string> = {
  name: '名称', nameLocal: '名称（日本語）', identifier: '品番・識別子', date: '日付', docID: '整理番号', comment: 'コメント',
  division: '部署名', divisionLocal: '部署名（日本語）', title: '役職', titleLocal: '役職（日本語）', email: 'e-mailアドレス', phone: '電話番号',
  internalAddress: '内線番号', street: '番地', streetLocal: '番地（日本語）', city: '市町村', cityLocal: '市町村（日本語）',
  stateProvince: '都道府県', stateProvinceLocal: '都道府県（日本語）', country: '国または地域', postalCode: '郵便番号',
  mass: '質量', unitOfMeasure: '質量単位', unitType: '報告単位', version: '版数', effectiveDate: '発効日',
  requesterName: '依頼者側の製品名', requesterIdentifier: '依頼者側の製品品番', productFamilyName: 'シリーズ品名', isArticle: '成形品',
  authority: '発行機関', identity: '識別', entryIdentity: '登録番号', nameOfSectional: '伝達事項', mode: 'モード',
  schemaDatabaseVersion: 'スキーマ版', charaLocal: '言語', declarationComplete: '宣言完了',
}

export interface PartyRow {
  label: string
  english: string
  /** 日本語の属性が無い項目では undefined です。 */
  local?: string
  required: boolean
}

/** 遵法判断情報シートの1行分（Compliance配下の DsDsg 1つ）です。chemSHERPA-AIの「遵法判断情報画面」の列に合わせています。 */
export interface ComplianceRow {
  /** DsDsgID の entryIdentity（例: 00021）です。 */
  id: string
  name: string
  /** 報告用途（reportableApplication）です。 */
  application: string
  /** 報告閾値（reportingThreshold）です。 */
  threshold: string
  /** 含有判定です。aboveComplianceThreshold が true なら Y、false なら N です。 */
  judgement: 'Y' | 'N' | ''
  /** 含有率(ppm)です。MassPercent（質量%）を ppm に換算します。 */
  ppm: string
  mass: string
  unit: string
  /** 用途コード（例: EU-RoHS-6(c)）です。 */
  exemptionCode: string
  exemptionDescription: string
  /** 使用用途・使用部位は comment を「@」で区切った4・5番目に入っています。 */
  usage: string
  location: string
}

/** 含有判定がYの物質で、ツール画面で * の付く項目です。 */
const COMPLIANCE_REQUIRED: [keyof ComplianceRow, string][] = [['ppm', '含有率(ppm)'], ['mass', '含有量'], ['unit', '単位']]

export interface ProductSummary {
  item: ShaiItem
  /** PRODUCT_SPECS と同じ並びの値です。値が無い場合は空文字です。 */
  product: string[]
  /** 発行者情報（会社名と担当者）です。 */
  issuer: PartyRow[]
  approver: PartyRow[]
  response: { date: string, docID: string, comment: string }
  /** 伝達事項（Include/Sectional）です。 */
  sectionals: string[]
  /** 未入力の必須項目（例: 「発行者 部署名」）です。 */
  missing: string[]
  compliance: ComplianceRow[]
  /** 確定日時です。Product の comment を「@」で区切った2番目に入っています。 */
  confirmedAt: string
  /** 対象エリア（DeclarableSubstanceList の authority と version）です。 */
  area: string
  /** 含有総合判定です。含有判定がYの物質が1つでもあれば Y です。 */
  overall: 'Y' | 'N' | ''
}

function localNameOf(element: Element): string {
  return element.localName || element.nodeName.replace(/^.*:/, '')
}

/** 数値として読める値は、Excelで計算や並べ替えができるよう数値にします。 */
function toNumber(value: string): string | number {
  return value !== '' && !Number.isNaN(Number(value)) ? Number(value) : value
}

/** 1品目のXMLから、製品情報・発行者・承認者と必須項目の未入力を取り出します。 */
export function summarizeItem(item: ShaiItem): ProductSummary {
  const doc = parseDocument(item.data)
  const elements = doc ? Array.from(doc.getElementsByTagName('*')) : []
  const first = (name: string) => elements.find((element) => localNameOf(element) === name)
  const attr = (element: Element | undefined, name?: string) => (name && element?.getAttribute(name)?.trim()) || ''

  const product = PRODUCT_SPECS.map((spec) => {
    const raw = attr(first(spec.element), spec.attribute)
    return raw && spec.format ? spec.format(raw) : raw
  })
  const partyOf = (element: Element | undefined): PartyRow[] => PARTY_SPECS.map((spec) => ({
    label: spec.label,
    english: attr(element, spec.attribute),
    local: spec.localAttribute ? attr(element, spec.localAttribute) : undefined,
    required: !!spec.required,
  }))
  const company = first('SupplyCompany')
  const issuer = [
    { label: '会社名', english: attr(company, 'name'), local: attr(company, 'nameLocal'), required: true },
    ...partyOf(first('Contact')),
  ]
  const approver = partyOf(first('Authorizer'))
  const response = first('Response')

  const missing = [
    ...PRODUCT_SPECS.filter((spec, index) => spec.required && product[index] === '').map((spec) => `製品 ${spec.label}`),
    ...issuer.filter((row) => row.required && row.english === '').map((row) => `発行者 ${row.label}`),
    ...approver.filter((row) => row.required && row.english === '').map((row) => `承認者 ${row.label}`),
  ]
  const sectionals = elements
    .filter((element) => localNameOf(element) === 'Sectional')
    .map((element) => attr(element, 'nameOfSectional'))
    .filter((value) => value !== '')
    .map((value) => SECTIONALS[value] ?? value)

  const childrenOf = (element: Element, name: string) => Array.from(element.children).filter((child) => localNameOf(child) === name)
  const compliance: ComplianceRow[] = elements.filter((element) => localNameOf(element) === 'DsDsg').map((dsdsg) => {
    const threshold = childrenOf(dsdsg, 'ComplianceThreshold')[0]
    const above = attr(threshold, 'aboveComplianceThreshold')
    const massPercent = attr(childrenOf(dsdsg, 'MassPercent')[0], 'massPercent')
    const mass = childrenOf(dsdsg, 'Mass')[0]
    const exemptions = childrenOf(dsdsg, 'Exemptions').flatMap((group) => {
      // UniqueID が後に続く Exemption の基準（例: EU-RoHS-AnnexIII）を表します。
      let base = ''
      return Array.from(group.children).flatMap((child) => {
        if (localNameOf(child) === 'UniqueID') { base = attr(child, 'identity').replace(/-Annex[^-]*$/i, ''); return [] }
        if (localNameOf(child) !== 'Exemption') return []
        const index = attr(child, 'regIndex') || attr(child, 'identity')
        return [{ code: base ? `${base}-${index}` : index, description: attr(child, 'description') }]
      })
    })
    const comment = attr(dsdsg, 'comment').split('@')
    return {
      id: attr(childrenOf(dsdsg, 'DsDsgID')[0], 'entryIdentity'),
      name: attr(dsdsg, 'name'),
      application: attr(threshold, 'reportableApplication'),
      threshold: attr(threshold, 'reportingThreshold'),
      judgement: above === 'true' ? 'Y' : above === 'false' ? 'N' : '',
      ppm: massPercent && !Number.isNaN(Number(massPercent)) ? String(Math.round(Number(massPercent) * 10000 * 1e6) / 1e6) : massPercent,
      mass: attr(mass, 'mass'),
      unit: attr(mass, 'unitOfMeasure'),
      exemptionCode: exemptions.map((exemption) => exemption.code).join('、'),
      exemptionDescription: exemptions.map((exemption) => exemption.description).filter(Boolean).join('、'),
      usage: comment[3] ?? '',
      location: comment[4] ?? '',
    }
  })
  compliance.filter((row) => row.judgement === 'Y').forEach((row) => {
    COMPLIANCE_REQUIRED.forEach(([key, label]) => { if (row[key] === '') missing.push(`遵法 ID${row.id} ${label}`) })
  })
  const list = first('DeclarableSubstanceList')
  const overall = compliance.length === 0 ? '' : compliance.some((row) => row.judgement === 'Y') ? 'Y' : 'N'

  return {
    item, product, issuer, approver, sectionals, missing, compliance, overall,
    confirmedAt: attr(first('Product'), 'comment').split('@')[1] ?? '',
    area: [attr(list, 'authority'), attr(list, 'version')].filter(Boolean).join(' '),
    response: { date: attr(response, 'date'), docID: attr(response, 'docID'), comment: attr(response, 'comment') },
  }
}

const fill = (argb: string) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const
const HEADER_FILL = fill('FFCDE6F7')
const LABEL_FILL = fill('FFE3F0FA')
const MISSING_FILL = fill('FFFFE1E1')
const OK_FILL = fill('FFE6F6EC')
const CONTAINED_FILL = fill('FFFFF2CC')
const BORDER = { style: 'thin', color: { argb: 'FF9FB4CC' } } as const
const BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER }
const MISSING_FONT = { color: { argb: 'FFB42318' }, bold: true }

function markMissing(sheet: Worksheet, row: number, column: number) {
  const cell = sheet.getCell(row, column)
  cell.value = '（未入力）'
  cell.fill = MISSING_FILL
  cell.font = MISSING_FONT
}

function boxRange(sheet: Worksheet, fromRow: number, toRow: number, columns: number) {
  for (let row = fromRow; row <= toRow; row += 1) {
    for (let column = 1; column <= columns; column += 1) {
      const cell = sheet.getCell(row, column)
      cell.border = BORDERS
      cell.alignment = { vertical: 'top', wrapText: true }
    }
  }
}

function styleHeader(sheet: Worksheet, row: number, columns: number) {
  for (let column = 1; column <= columns; column += 1) {
    const cell = sheet.getCell(row, column)
    cell.fill = HEADER_FILL
    cell.font = { bold: true }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  }
}

function addProductSheet(sheet: Worksheet, summaries: ProductSummary[], sourceName: string) {
  sheet.addRow([`製品・部品情報（元ファイル: ${sourceName}）`]).font = { bold: true, size: 12 }
  sheet.addRow(['見出しの * は必須項目です。赤色のセルは未入力の必須項目を示します。']).font = { color: { argb: 'FF8A5B00' }, size: 10 }
  sheet.addRow([])
  const headers = ['No.', ...PRODUCT_SPECS.map((spec) => spec.required ? `${spec.label} *` : spec.label), '伝達事項', '確定日時', '対象エリア', '含有総合判定', '含有物質(Y)', '必須項目の確認', 'XMLファイル名']
  const header = sheet.addRow(headers)
  sheet.columns = [{ width: 6 }, ...PRODUCT_SPECS.map((spec) => ({ width: spec.width })), { width: 16 }, { width: 17 }, { width: 16 }, { width: 8 }, { width: 30 }, { width: 30 }, { width: 46 }]
  summaries.forEach((summary, index) => {
    const contained = summary.compliance.filter((row) => row.judgement === 'Y').map((row) => `${row.id} ${row.name}`).join('\n')
    const row = sheet.addRow([index + 1, ...summary.product, summary.sectionals.join('、'), summary.confirmedAt, summary.area, summary.overall, contained, summary.missing.length === 0 ? '○ すべて入力済み' : `× 未入力 ${summary.missing.length}件: ${summary.missing.join('、')}`, summary.item.xmlFileName])
    PRODUCT_SPECS.forEach((spec, specIndex) => { if (spec.required && summary.product[specIndex] === '') markMissing(sheet, row.number, specIndex + 2) })
    if (summary.overall === 'Y') row.getCell(PRODUCT_SPECS.length + 5).fill = CONTAINED_FILL
    const check = row.getCell(PRODUCT_SPECS.length + 7)
    check.fill = summary.missing.length === 0 ? OK_FILL : MISSING_FILL
    if (summary.missing.length > 0) check.font = MISSING_FONT
  })
  boxRange(sheet, header.number, sheet.rowCount, headers.length)
  styleHeader(sheet, header.number, headers.length)
  sheet.views = [{ state: 'frozen', xSplit: 3, ySplit: header.number }]
  sheet.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number, column: headers.length } }
}

function addPartyTable(sheet: Worksheet, title: string, rows: PartyRow[]) {
  sheet.addRow([title]).font = { bold: true, size: 11 }
  const header = sheet.addRow(['項目', '英語', '日本語'])
  rows.forEach((partyRow) => {
    const row = sheet.addRow([partyRow.required ? `${partyRow.label} *` : partyRow.label, partyRow.english, partyRow.local ?? ''])
    row.getCell(1).fill = LABEL_FILL
    if (partyRow.local === undefined) row.getCell(3).fill = fill('FFEFEFEF')
    if (partyRow.required && partyRow.english === '') markMissing(sheet, row.number, 2)
  })
  boxRange(sheet, header.number, sheet.rowCount, 3)
  styleHeader(sheet, header.number, 3)
  sheet.addRow([])
}

/** 発行者・承認者は品目ごとに同じことが多いため、内容が同じ品目をまとめて1つの表にします。 */
function addPartySheet(sheet: Worksheet, summaries: ProductSummary[]) {
  sheet.columns = [{ width: 22 }, { width: 44 }, { width: 36 }]
  sheet.addRow(['発行者・承認者情報（必須は英語のみ）']).font = { bold: true, size: 12 }
  sheet.addRow(['項目の * は必須項目です。赤色のセルは未入力の必須項目を示します。']).font = { color: { argb: 'FF8A5B00' }, size: 10 }
  sheet.addRow([])
  const groups = new Map<string, ProductSummary[]>()
  summaries.forEach((summary) => {
    const key = JSON.stringify([summary.response, summary.issuer, summary.approver])
    groups.set(key, [...(groups.get(key) ?? []), summary])
  })
  groups.forEach((members) => {
    const [{ response, issuer, approver }] = members
    const target = sheet.addRow([groups.size === 1 ? '対象: すべての品目' : `対象: ${members.map((member) => member.item.productNumber).join('、')}`])
    target.font = { bold: true, color: { argb: 'FF1268D4' } }
    const responseHeader = sheet.addRow(['回答日', '整理番号', 'コメント'])
    sheet.addRow([response.date, response.docID, response.comment])
    boxRange(sheet, responseHeader.number, responseHeader.number + 1, 3)
    styleHeader(sheet, responseHeader.number, 3)
    sheet.addRow([])
    addPartyTable(sheet, '《発行者情報》', issuer)
    addPartyTable(sheet, '《承認者情報》', approver)
  })
}

const COMPLIANCE_HEADERS: [string, number][] = [
  ['製品品番', 14], ['製品名', 26], ['ID', 8], ['物質/物質群', 34], ['報告用途', 30], ['報告閾値', 34], ['含有判定 *', 9],
  ['含有率(ppm) *', 12], ['含有量 *', 10], ['単位 *', 7], ['用途コード', 16], ['適用除外の内容', 30], ['使用用途', 22], ['使用部位', 22],
]

/** chemSHERPA-AIの「遵法判断情報画面」に近い表です。onlyContained のときは含有判定がYの物質だけを出します。 */
function addComplianceSheet(sheet: Worksheet, summaries: ProductSummary[], onlyContained: boolean) {
  sheet.addRow([onlyContained ? '含有物質（含有判定が Y の物質）' : '遵法判断情報']).font = { bold: true, size: 12 }
  sheet.addRow([onlyContained
    ? '見出しの * は含有判定が Y のときの必須項目です。赤色のセルは未入力を示します。'
    : '含有判定が Y の行は黄色で表示します。見出しの * は Y のときの必須項目で、赤色のセルは未入力を示します。']).font = { color: { argb: 'FF8A5B00' }, size: 10 }
  sheet.addRow([])
  sheet.columns = COMPLIANCE_HEADERS.map(([, width]) => ({ width }))
  const header = sheet.addRow(COMPLIANCE_HEADERS.map(([label]) => label))
  summaries.forEach(({ item, compliance }) => {
    const rows = onlyContained ? compliance.filter((row) => row.judgement === 'Y') : compliance
    if (rows.length === 0) {
      sheet.addRow([item.productNumber, item.productName ?? '', '', onlyContained ? '（含有判定が Y の物質はありません）' : '（遵法判断情報なし）'])
      return
    }
    rows.forEach((compliance) => {
      const values = [compliance.ppm, compliance.mass, compliance.unit]
      const row = sheet.addRow([
        item.productNumber, item.productName ?? '', compliance.id, compliance.name, compliance.application, compliance.threshold, compliance.judgement,
        toNumber(compliance.ppm), toNumber(compliance.mass), compliance.unit,
        compliance.exemptionCode, compliance.exemptionDescription, compliance.usage, compliance.location,
      ])
      if (compliance.judgement !== 'Y') return
      for (let column = 1; column <= COMPLIANCE_HEADERS.length; column += 1) row.getCell(column).fill = CONTAINED_FILL
      row.getCell(7).font = { bold: true, color: { argb: 'FFB42318' } }
      values.forEach((value, index) => { if (value === '') markMissing(sheet, row.number, 8 + index) })
    })
  })
  boxRange(sheet, header.number, sheet.rowCount, COMPLIANCE_HEADERS.length)
  styleHeader(sheet, header.number, COMPLIANCE_HEADERS.length)
  sheet.views = [{ state: 'frozen', xSplit: 4, ySplit: header.number }]
  sheet.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number, column: COMPLIANCE_HEADERS.length } }
}

function addRegulationSheet(sheet: Worksheet) {
  sheet.columns = [{ header: 'コード', width: 8 }, { header: '略称', width: 18 }, { header: '管理対象基準/候補物質', width: 80 }, { header: '制定・改訂', width: 36 }]
  REGULATIONS.forEach((regulation) => sheet.addRow(regulation))
  boxRange(sheet, 1, sheet.rowCount, 4)
  styleHeader(sheet, 1, 4)
  sheet.addRow([])
  sheet.addRow(['chemSHERPA-AIツール「管理対象基準/候補物質の詳細」（物質リストバージョン 2.13.00）より']).font = { color: { argb: 'FF68758A' }, size: 10 }
}

function addAllFieldsSheet(sheet: Worksheet, summaries: ProductSummary[]) {
  sheet.columns = [
    { header: 'No.', width: 7 }, { header: '製品品番', width: 14 }, { header: '製品名', width: 30 }, { header: '要素のパス', width: 50 },
    { header: '項目', width: 22 }, { header: '項目の説明', width: 20 }, { header: '値', width: 50 },
  ]
  let count = 0
  summaries.forEach(({ item }) => {
    buildXmlView(item.data).fields.forEach((field) => {
      count += 1
      const attribute = field.name.startsWith('@') ? field.name.slice(1) : ''
      sheet.addRow([count, item.productNumber, item.productName ?? '', field.path, field.name, ATTRIBUTE_LABELS[attribute] ?? '', field.value])
    })
  })
  styleHeader(sheet, 1, 7)
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } }
}

/**
 * 品目ごとの内容を、受け取った人が確認しやすいExcelにまとめます。
 * chemSHERPA-AI（作成支援）ツールの画面に近い並びで、必須項目の未入力を赤で示します。
 */
export async function createExcel(items: ShaiItem[], sourceName: string): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SHAIファイル分割'
  workbook.created = new Date()
  const summaries = items.map(summarizeItem)
  // 印刷時はA4横で、幅を1ページに収めます。
  const addSheet = (name: string) => workbook.addWorksheet(name, { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } })
  addProductSheet(addSheet('製品情報'), summaries, sourceName)
  addPartySheet(addSheet('発行者・承認者'), summaries)
  addComplianceSheet(addSheet('含有物質(Y)'), summaries, true)
  addComplianceSheet(addSheet('遵法判断情報'), summaries, false)
  addAllFieldsSheet(addSheet('全項目'), summaries)
  addRegulationSheet(addSheet('管理対象基準'))
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/** 「〜.shai」から「〜.xlsx」のファイル名を作ります。 */
export function excelFileNameOf(shaiFileName: string): string {
  return `${shaiFileName.replace(/\.shai$/i, '')}.xlsx`
}
