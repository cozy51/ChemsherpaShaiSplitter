/** ファイル名として使えない文字（Windows / macOS / Linux で共通に避けるもの）です。 */
const INVALID_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g
/** Windowsで予約されているデバイス名です。 */
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
/** 長すぎるファイル名を避けるための上限です。 */
const MAX_LENGTH = 100

/**
 * 任意の文字列を、そのままダウンロードファイル名に使える形へ整えます。
 * 使える文字が残らない場合は undefined を返します。
 */
export function sanitizeFileBaseName(value: string | undefined): string | undefined {
  if (!value) return undefined
  const cleaned = value
    .replace(INVALID_CHARS, '_')
    .replace(/\s+/g, ' ')
    .trim()
    // Windowsでは末尾の空白とピリオドが落とされるため、あらかじめ取り除きます。
    .replace(/[.\s]+$/, '')
    .slice(0, MAX_LENGTH)
    .replace(/[.\s]+$/, '')
  if (cleaned === '' || /^_+$/.test(cleaned)) return undefined
  return RESERVED_NAMES.test(cleaned) ? `_${cleaned}` : cleaned
}
