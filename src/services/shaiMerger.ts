import JSZip from 'jszip'
import type { ShaiItem } from '../types'
import { sanitizeFileBaseName } from './fileNameSanitizer'

export interface MergeResult {
  blob: Blob
  /** 結合後のZIP直下に格納したXMLファイル名です。 */
  xmlFileNames: string[]
  warnings: string[]
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false
  return true
}

/** SHAI_日時_製品品番_連番.xml の連番を、使われていない番号に付け替えます。 */
function renumber(fileName: string, used: Set<string>): string {
  const match = /^(SHAI_\d{14}_[^_]+_)(\d+)(\.xml)$/i.exec(fileName)
  const [prefix, digits, extension] = match ? [match[1], match[2], match[3]] : [fileName.replace(/\.xml$/i, '_'), '0', '.xml']
  for (let number = Number(digits) + 1; ; number += 1) {
    const candidate = `${prefix}${String(number).padStart(digits.length, '0')}${extension}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
}

/**
 * 複数の品目XMLを1つの .shai（ZIP直下にXMLを並べたもの）にまとめます。XMLの中身は変更しません。
 * - 同じ名前で中身も同じXMLは重複として1つだけ入れます。
 * - 同じ名前で中身が異なるXMLは、上書きを避けるため末尾の連番を付け替えて入れます。
 */
export async function mergeShaiItems(items: ShaiItem[]): Promise<MergeResult> {
  const zip = new JSZip()
  const stored = new Map<string, ShaiItem>()
  const xmlFileNames: string[] = []
  const warnings: string[] = []

  for (const item of items) {
    const key = item.xmlFileName.toLowerCase()
    const existing = stored.get(key)
    if (existing && sameBytes(existing.data, item.data)) {
      warnings.push(`「${item.xmlFileName}」は同じ内容のXMLがすでにあるため、1つだけ入れました。`)
      continue
    }
    let fileName = item.xmlFileName
    if (existing) {
      fileName = renumber(item.xmlFileName, new Set(stored.keys()))
      warnings.push(`「${item.xmlFileName}」は同じ名前で内容の異なるXMLがあるため、「${fileName}」として入れました。`)
    }
    stored.set(fileName.toLowerCase(), item)
    xmlFileNames.push(fileName)
    zip.file(fileName, item.data)
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, xmlFileNames, warnings }
}

/** 入力されたファイル名を、拡張子 .shai 付きの安全な名前に整えます。 */
export function mergedFileNameOf(input: string): string {
  const base = sanitizeFileBaseName(input.replace(/\.shai$/i, '')) ?? 'SHAI_merged'
  return `${base}.shai`
}

/** 結合ファイル名の初期値です（例: SHAI_merged_20261028093000）。 */
export function defaultMergedName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `SHAI_merged_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}
