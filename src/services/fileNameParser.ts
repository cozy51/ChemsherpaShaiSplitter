export interface ParsedShaiFileName {
  productNumber: string
}

/** SHAI_日時_製品品番_連番.xml から製品品番を取得します。 */
export function parseShaiXmlFileName(fileName: string): ParsedShaiFileName | null {
  const match = /^SHAI_\d{14}_([^_]+)_\d+\.xml$/i.exec(fileName)
  if (!match) return null
  return { productNumber: match[1] }
}
