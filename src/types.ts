export interface ShaiItem {
  id: string
  productNumber: string
  /** XMLから取得した製品名。取得できなかった場合は未設定です。 */
  productName?: string
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
