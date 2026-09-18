export interface XmlDetails {
  productName?: string
  manufacturer?: string
}

// 将来、XML内容から詳細情報を取得するための独立した拡張ポイントです。
export function parseXmlDetails(_data: Uint8Array): XmlDetails {
  return {}
}
