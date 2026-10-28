export interface ShaiItem {
  id: string
  productNumber: string
  /** XMLから取得した製品名。取得できなかった場合は未設定です。 */
  productName?: string
  xmlFileName: string
  data: Uint8Array
}

/** 分割前の .shai（ZIP）に入っているファイル1件分です。 */
export interface ShaiEntry {
  /** ZIP内のパスです。 */
  name: string
  size: number
  date: Date
  /** item: 分割対象の品目XML / excluded: 名前の形式が違うため除外したXML / other: 分割では使わないファイル */
  kind: 'item' | 'excluded' | 'other'
  data: Uint8Array
}

export interface LoadedShai {
  sourceName: string
  /** 読み込んだ .shai 自体のバイト数です。 */
  sourceSize: number
  items: ShaiItem[]
  entries: ShaiEntry[]
  warnings: string[]
}

export interface SplitFile {
  id: string
  fileName: string
  blob: Blob
}
