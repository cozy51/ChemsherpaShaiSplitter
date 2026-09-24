export interface XmlDetails {
  productName?: string
}

/**
 * chemSHERPAのスキーマはバージョンによって要素名が異なるため、特定のタグ名に依存せず
 * 「製品品番と同じ階層にある名称要素」を探して製品名を取得します。
 */
const EXACT_NAME_TAGS = [
  'productname',
  'productnametext',
  'productnameja',
  'productnamejp',
  'articlename',
  'itemname',
  'modelname',
  'partname',
  'goodsname',
  '製品名',
  '品名',
]

/** 名称らしい要素名かどうかの判定に使います。 */
const NAME_HINT = /name|名/
/** 製品名以外の名称（会社名・担当者名・材質名など）を除外します。 */
const NAME_EXCLUDE =
  /company|corp|issuer|supplier|author|request|contact|person|division|department|section|file|user|customer|country|responder|sender|receiver|staff|organization|substance|material|chemical|会社|担当|部署|発行|ファイル|材質|物質/

/** 製品品番の要素からさかのぼって製品名を探す階層の深さです。 */
const ANCESTOR_DEPTH = 4

/** 名前空間の接頭辞や区切り文字を無視して要素名を比較できる形に整えます。 */
function normalizeTagName(element: Element): string {
  const local = element.localName || element.nodeName.replace(/^.*:/, '')
  return local.replace(/[_\-.\s]/g, '').toLowerCase()
}

function textOf(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function leafElementsOf(scope: Element | Document): Element[] {
  return Array.from(scope.getElementsByTagName('*')).filter((element) => element.children.length === 0)
}

/** XML宣言のencodingを尊重しつつ文字列へ変換します。 */
function decodeXml(data: Uint8Array): string {
  const head = new TextDecoder('utf-8').decode(data.slice(0, 200))
  const declared = /encoding=["']([\w-]+)["']/i.exec(head)?.[1]
  if (declared && !/^utf-?8$/i.test(declared)) {
    try {
      return new TextDecoder(declared).decode(data)
    } catch {
      // 未対応のencodingはUTF-8として読み直します。
    }
  }
  return new TextDecoder('utf-8').decode(data)
}

function parseDocument(data: Uint8Array): Document | null {
  if (typeof DOMParser === 'undefined') return null
  // 文字列へ変換済みのためencoding指定は取り除いてから解析します。
  const xml = decodeXml(data).replace(/^(<\?xml[^>]*?)\s+encoding=["'][^"']*["']/i, '$1')
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    return doc.getElementsByTagName('parsererror').length > 0 ? null : doc
  } catch {
    return null
  }
}

/** 対象範囲の中から製品名にあたる要素のテキストを取り出します。 */
function pickNameText(scope: Element | Document): string | undefined {
  const leaves = leafElementsOf(scope).filter((element) => textOf(element) !== '')
  for (const tag of EXACT_NAME_TAGS) {
    const matched = leaves.find((element) => normalizeTagName(element) === tag)
    if (matched) return textOf(matched)
  }
  const loose = leaves.find((element) => {
    const tag = normalizeTagName(element)
    return NAME_HINT.test(tag) && !NAME_EXCLUDE.test(tag)
  })
  return loose ? textOf(loose) : undefined
}

/** 製品品番を手がかりに、同じ製品情報ブロックの中から製品名を探します。 */
function findNameNearProductNumber(doc: Document, productNumber: string): string | undefined {
  const anchors = leafElementsOf(doc).filter((element) => textOf(element) === productNumber)
  for (const anchor of anchors) {
    let scope = anchor.parentElement
    for (let depth = 0; scope && depth < ANCESTOR_DEPTH; depth += 1) {
      const name = pickNameText(scope)
      if (name && name !== productNumber) return name
      scope = scope.parentElement
    }
  }
  return undefined
}

/** 属性の中から製品名にあたる値を取り出します。 */
function pickNameAttribute(element: Element): string | undefined {
  const attributes = Array.from(element.attributes).filter((attribute) => attribute.value.trim() !== '')
  const normalized = (attribute: Attr) => (attribute.localName || attribute.name).replace(/[_\-.\s]/g, '').toLowerCase()
  for (const tag of ['name', ...EXACT_NAME_TAGS]) {
    const matched = attributes.find((attribute) => normalized(attribute) === tag)
    if (matched) return matched.value.replace(/\s+/g, ' ').trim()
  }
  return undefined
}

/**
 * chemSHERPA（IEC62474形式）では `<ProductID name="製品名" identifier="製品品番">` のように
 * 属性で持つため、製品品番と同じ要素の属性から製品名を探します。
 */
function findNameInAttributes(doc: Document, productNumber?: string): string | undefined {
  const elements = Array.from(doc.getElementsByTagName('*'))
  if (productNumber) {
    for (const element of elements) {
      if (NAME_EXCLUDE.test(normalizeTagName(element))) continue
      const hasProductNumber = Array.from(element.attributes).some((attribute) => attribute.value.trim() === productNumber)
      if (!hasProductNumber) continue
      const name = pickNameAttribute(element)
      if (name && name !== productNumber) return name
    }
  }
  const productId = elements.find((element) => normalizeTagName(element) === 'productid')
  return productId ? pickNameAttribute(productId) : undefined
}

/** XMLの内容から製品名を取得します。取得できない場合は空のオブジェクトを返します。 */
export function parseXmlDetails(data: Uint8Array, productNumber?: string): XmlDetails {
  const doc = parseDocument(data)
  if (!doc) return {}

  const byAttribute = findNameInAttributes(doc, productNumber)
  if (byAttribute) return { productName: byAttribute }

  const byProductNumber = productNumber ? findNameNearProductNumber(doc, productNumber) : undefined
  if (byProductNumber) return { productName: byProductNumber }

  const leaves = leafElementsOf(doc).filter((element) => textOf(element) !== '')
  for (const tag of EXACT_NAME_TAGS) {
    const matched = leaves.find((element) => normalizeTagName(element) === tag)
    if (matched) return { productName: textOf(matched) }
  }
  return {}
}
