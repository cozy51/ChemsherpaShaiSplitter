import { describe, expect, it } from 'vitest'
import { parseShaiXmlFileName } from './fileNameParser'

describe('parseShaiXmlFileName', () => {
  it('製品品番を取得する', () => {
    expect(parseShaiXmlFileName('SHAI_20260724084312_100-056-024_001.xml'))
      .toEqual({ productNumber: '100-056-024' })
  })

  it.each(['other.xml', 'SHAI_wrong_100-056-024_001.xml', 'SHAI_20260724084312_100-056-024.xml'])(
    '想定外の形式を拒否する: %s', (name) => expect(parseShaiXmlFileName(name)).toBeNull(),
  )
})
