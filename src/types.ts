export interface ShaiItem {
  id: string
  productNumber: string
  xmlFileName: string
  data: Uint8Array
}

export interface LoadedShai {
  sourceName: string
  items: ShaiItem[]
  warnings: string[]
}

export interface SplitFile {
  id: string
  fileName: string
  blob: Blob
}
