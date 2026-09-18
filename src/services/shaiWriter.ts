import JSZip from 'jszip'
import type { ShaiItem, SplitFile } from '../types'
import { sanitizeFileBaseName } from './fileNameSanitizer'

/** 分割後のファイル名は製品名を優先し、取得できない場合は製品品番を使います。 */
function baseNameOf(item: ShaiItem): string {
  return sanitizeFileBaseName(item.productName) ?? sanitizeFileBaseName(item.productNumber) ?? 'SHAI'
}

export async function createSplitFiles(items: ShaiItem[]): Promise<SplitFile[]> {
  const usedNames = new Map<string, number>()
  return Promise.all(items.map(async (item) => {
    const base = baseNameOf(item)
    // 大文字小文字を区別しないファイルシステムでも衝突しないように数えます。
    const key = base.toLowerCase()
    const count = (usedNames.get(key) ?? 0) + 1
    usedNames.set(key, count)
    const suffix = count === 1 ? '' : `_${count}`
    const fileName = `${base}${suffix}.shai`
    const zip = new JSZip()
    zip.file(item.xmlFileName, item.data)
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    return { id: item.id, fileName, blob }
  }))
}

export async function createBundle(files: SplitFile[]): Promise<Blob> {
  const zip = new JSZip()
  files.forEach((file) => zip.file(file.fileName, file.blob))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}
