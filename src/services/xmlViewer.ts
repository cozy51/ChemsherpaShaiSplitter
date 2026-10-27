import JSZip from 'jszip'
import type { ShaiItem } from '../types'
import { decodeXml, parseDocument } from './xmlParser'

export interface XmlAttribute {
  name: string
  value: string
}

export interface XmlNode {
  name: string
  /** ルートからの位置を表すパス（例: Main/Product[1]/ProductID）です。 */
  path: string
  attributes: XmlAttribute[]
  /** 子要素を持たない場合の本文、または子要素と並ぶ本文です。 */
  text?: string
  children: XmlNode[]
}

/** 「どの項目にどんな値が入っているか」を一覧表示するための1行分です。 */
export interface XmlField {
  path: string
  name: string
  value: string
}

export interface XmlView {
  root?: XmlNode
  fields: XmlField[]
  /** 表示用に整形したXMLソースです。解析できない場合は元の文字列をそのまま使います。 */
  source: string
  parseError: boolean
}

export interface CheckResult {
  label: string
  ok: boolean
  detail: string
}

export interface SplitInspection {
  entries: string[]
  view?: XmlView
  checks: CheckResult[]
}

function ownTextOf(element: Element): string {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === 3 || node.nodeType === 4)
    .map((node) => node.nodeValue ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

function toNode(element: Element, path: string): XmlNode {
  const counts = new Map<string, number>()
  const totals = new Map<string, number>()
  Array.from(element.children).forEach((child) => totals.set(child.nodeName, (totals.get(child.nodeName) ?? 0) + 1))
  const children = Array.from(element.children).map((child) => {
    const name = child.nodeName
    const index = (counts.get(name) ?? 0) + 1
    counts.set(name, index)
    // 同名の要素が複数あるときだけ番号を付けて区別します。
    const suffix = (totals.get(name) ?? 0) > 1 ? `[${index}]` : ''
    return toNode(child, `${path}/${name}${suffix}`)
  })
  const text = ownTextOf(element)
  return {
    name: element.nodeName,
    path,
    attributes: Array.from(element.attributes).map((attribute) => ({ name: attribute.name, value: attribute.value })),
    text: text === '' ? undefined : text,
    children,
  }
}

function collectFields(node: XmlNode, fields: XmlField[]) {
  node.attributes.forEach((attribute) => fields.push({ path: node.path, name: `@${attribute.name}`, value: attribute.value }))
  if (node.text !== undefined) fields.push({ path: node.path, name: '(値)', value: node.text })
  node.children.forEach((child) => collectFields(child, fields))
}

function escapeXml(value: string, attribute = false): string {
  const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return attribute ? escaped.replace(/"/g, '&quot;') : escaped
}

function formatNode(node: XmlNode, depth: number, lines: string[]) {
  const indent = '  '.repeat(depth)
  const attributes = node.attributes.map((attribute) => ` ${attribute.name}="${escapeXml(attribute.value, true)}"`).join('')
  if (node.children.length === 0) {
    lines.push(node.text === undefined
      ? `${indent}<${node.name}${attributes} />`
      : `${indent}<${node.name}${attributes}>${escapeXml(node.text)}</${node.name}>`)
    return
  }
  lines.push(`${indent}<${node.name}${attributes}>`)
  if (node.text !== undefined) lines.push(`${indent}  ${escapeXml(node.text)}`)
  node.children.forEach((child) => formatNode(child, depth + 1, lines))
  lines.push(`${indent}</${node.name}>`)
}

/** XMLを表示用のツリー・項目一覧・整形済みソースへ変換します。 */
export function buildXmlView(data: Uint8Array): XmlView {
  const doc = parseDocument(data)
  if (!doc?.documentElement) return { fields: [], source: decodeXml(data), parseError: true }
  const root = toNode(doc.documentElement, doc.documentElement.nodeName)
  const fields: XmlField[] = []
  collectFields(root, fields)
  const declaration = /^\s*(<\?xml[^>]*\?>)/.exec(decodeXml(data))?.[1]
  const lines = declaration ? [declaration] : []
  formatNode(root, 0, lines)
  return { root, fields, source: lines.join('\n'), parseError: false }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false
  return true
}

function countFieldDifferences(before: XmlField[], after: XmlField[]): number {
  const length = Math.max(before.length, after.length)
  let differences = 0
  for (let index = 0; index < length; index += 1) {
    const a = before[index]
    const b = after[index]
    if (!a || !b || a.path !== b.path || a.name !== b.name || a.value !== b.value) differences += 1
  }
  return differences
}

/** 分割後のSHAIを開き直し、分割前の品目と内容が一致しているかを確認します。 */
export async function inspectSplitFile(blob: Blob, original: ShaiItem): Promise<SplitInspection> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(await blob.arrayBuffer())
  } catch {
    return { entries: [], checks: [{ label: 'ZIP形式', ok: false, detail: 'ZIP形式として読み込めませんでした。' }] }
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir).map((entry) => entry.name)
  const checks: CheckResult[] = [{
    label: '格納ファイル',
    ok: entries.length === 1 && entries[0] === original.xmlFileName,
    detail: entries.length === 1 && entries[0] === original.xmlFileName
      ? `分割前と同じ名前のXMLが1件だけ格納されています（${original.xmlFileName}）。`
      : `想定: ${original.xmlFileName} の1件 / 実際: ${entries.join(', ') || 'なし'}`,
  }]

  const entry = zip.file(original.xmlFileName)
  if (!entry) return { entries, checks }
  const data = await entry.async('uint8array')
  const view = buildXmlView(data)
  const before = buildXmlView(original.data)

  const identical = sameBytes(data, original.data)
  checks.push({
    label: 'XMLデータ',
    ok: identical,
    detail: identical
      ? `分割前とバイト単位で完全に一致しています（${data.length.toLocaleString()} バイト）。`
      : `分割前（${original.data.length.toLocaleString()} バイト）と内容が異なります（${data.length.toLocaleString()} バイト）。`,
  })
  checks.push({ label: 'XML構文', ok: !view.parseError, detail: view.parseError ? 'XMLとして解析できませんでした。' : 'XMLとして正しく解析できます。' })

  if (!view.parseError) {
    const differences = countFieldDifferences(before.fields, view.fields)
    checks.push({
      label: '項目と値',
      ok: differences === 0,
      detail: differences === 0
        ? `全 ${view.fields.length.toLocaleString()} 項目の値が分割前と一致しています。`
        : `${differences.toLocaleString()} 項目で分割前と値が異なります。`,
    })
    const hasNumber = view.fields.some((field) => field.value.trim() === original.productNumber)
    checks.push({
      label: '製品品番',
      ok: hasNumber,
      detail: hasNumber
        ? `XML内にファイル名の製品品番（${original.productNumber}）が含まれています。`
        : `XML内にファイル名の製品品番（${original.productNumber}）が見つかりません。`,
    })
  }
  return { entries, view, checks }
}
