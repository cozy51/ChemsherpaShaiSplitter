import { describe, expect, it } from 'vitest'
import { parseXmlDetails } from './xmlParser'

const encoder = new TextEncoder()
const toData = (xml: string) => encoder.encode(xml)

describe('parseXmlDetails', () => {
  it('製品品番と同じブロックにある製品名を取得する', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <declaration>
        <issuerInfo><companyName>発行会社</companyName><personName>担当 太郎</personName></issuerInfo>
        <productInfo>
          <productNumber>100-132-760</productNumber>
          <productName>SGM7J-04AFA6E</productName>
        </productInfo>
        <composition><part><partNumber>A-1</partNumber><materialName>PBT</materialName></part></composition>
      </declaration>`
    expect(parseXmlDetails(toData(xml), '100-132-760')).toEqual({ productName: 'SGM7J-04AFA6E' })
  })

  it('名前空間の接頭辞が付いていても取得する', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <ns:declaration xmlns:ns="http://example.com/chemsherpa">
        <ns:product><ns:ProductNumberText>100-056-024</ns:ProductNumberText><ns:ProductNameText>減速機ユニット</ns:ProductNameText></ns:product>
      </ns:declaration>`
    expect(parseXmlDetails(toData(xml), '100-056-024')).toEqual({ productName: '減速機ユニット' })
  })

  it('製品品番が見つからなくても既知のタグ名から製品名を取得する', () => {
    const xml = '<root><product><productName>ベアリング</productName></product></root>'
    expect(parseXmlDetails(toData(xml), '存在しない品番')).toEqual({ productName: 'ベアリング' })
  })

  it('材質名など製品名以外の名称は採用しない', () => {
    const xml = `<root>
      <product><number>100-132-760</number><materialName>ABS</materialName></product>
    </root>`
    expect(parseXmlDetails(toData(xml), '100-132-760')).toEqual({})
  })

  it('製品名が無いXMLでは空を返す', () => {
    const xml = '<root><product><number>100-132-760</number></product></root>'
    expect(parseXmlDetails(toData(xml), '100-132-760')).toEqual({})
  })

  it('XMLとして壊れていても例外を投げない', () => {
    expect(parseXmlDetails(toData('<root><unclosed>'), '100-132-760')).toEqual({})
  })
  it('chemSHERPA形式のProductID属性から製品名を取得する', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <Main xmlns="http://std.iec.ch/iec62474">
        <BusinessInfo><Response><SupplyCompany name="YASKAWA Electric Corporation" nameLocal="株式会社　安川電機" /></Response></BusinessInfo>
        <Product unitType="each">
          <ProductID name="SGMPS-04ACA-SD11 MOTOR 17INC,24V,ROHS" identifier="100-056-024" version="Y001"><Mass mass="2400" unitOfMeasure="g" /></ProductID>
          <Compliance><DsDsg name="Lead dinitrate" /></Compliance>
        </Product>
      </Main>`
    expect(parseXmlDetails(toData(xml), '100-056-024')).toEqual({ productName: 'SGMPS-04ACA-SD11 MOTOR 17INC,24V,ROHS' })
    expect(parseXmlDetails(toData(xml))).toEqual({ productName: 'SGMPS-04ACA-SD11 MOTOR 17INC,24V,ROHS' })
  })
})
