import JSZip from 'jszip'
import type { ShaiItem, SplitFile } from '../types'

export async function createSplitFiles(items: ShaiItem[]): Promise<SplitFile[]> {
  const usedNames = new Map<string, number>()
  return Promise.all(items.map(async (item) => {
    const count = (usedNames.get(item.productNumber) ?? 0) + 1
    usedNames.set(item.productNumber, count)
    const suffix = count === 1 ? '' : `_${count}`
    const fileName = `${item.productNumber}${suffix}.shai`
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
