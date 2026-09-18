import JSZip from 'jszip'
import type { LoadedShai } from '../types'
import { parseShaiXmlFileName } from './fileNameParser'

export async function readShaiFile(file: File): Promise<LoadedShai> {
  if (!file.name.toLowerCase().endsWith('.shai')) {
    throw new Error('.shai ファイルを選択してください。')
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer())
  } catch {
    throw new Error('ファイルをZIP形式として読み込めませんでした。正しいSHAlファイルか確認してください。')
  }

  const warnings: string[] = []
  const items: LoadedShai['items'] = []
  const rootXmlFiles = Object.values(zip.files).filter(
    (entry) => !entry.dir && !entry.name.includes('/') && entry.name.toLowerCase().endsWith('.xml'),
  )

  for (const entry of rootXmlFiles) {
    const parsed = parseShaiXmlFileName(entry.name)
    if (!parsed) {
      warnings.push(`「${entry.name}」は想定したファイル名形式ではないため除外しました。`)
      continue
    }
    items.push({
      id: entry.name,
      productNumber: parsed.productNumber,
      xmlFileName: entry.name,
      data: await entry.async('uint8array'),
    })
  }

  if (rootXmlFiles.length === 0) throw new Error('ZIP直下にXMLファイルが見つかりませんでした。')
  if (items.length === 0) throw new Error('処理可能なXMLファイルがありません。ファイル名形式を確認してください。')
  return { sourceName: file.name, items, warnings }
}
