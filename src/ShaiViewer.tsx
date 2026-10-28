import { useMemo, useState } from 'react'
import type { LoadedShai, ShaiEntry } from './types'
import { buildXmlView } from './services/xmlViewer'
import { ViewerFrame, XmlPanel } from './XmlViewer'

const KIND_LABELS: Record<ShaiEntry['kind'], string> = {
  item: '品目XML',
  excluded: '除外したXML',
  other: '対象外',
}

function isXml(entry: ShaiEntry): boolean {
  return entry.name.toLowerCase().endsWith('.xml') || /^\s*</.test(new TextDecoder().decode(entry.data.slice(0, 100)))
}

/** 先頭部分にNUL文字を含むものはバイナリとみなします。 */
function isText(entry: ShaiEntry): boolean {
  return !entry.data.slice(0, 1000).includes(0)
}

function EntryContent({ entry }: { entry: ShaiEntry }) {
  const view = useMemo(() => isXml(entry) ? buildXmlView(entry.data) : undefined, [entry])
  if (view) return <XmlPanel view={view} />
  if (isText(entry)) return <div className="viewer-body"><pre className="xml-source">{new TextDecoder().decode(entry.data)}</pre></div>
  return <p className="more">バイナリファイルのため内容は表示できません。</p>
}

/** 分割前の .shai（ZIP）に何が入っているかを一覧し、選んだファイルの中身を表示します。 */
export default function ShaiViewer({ loaded, onClose }: { loaded: LoadedShai, onClose: () => void }) {
  const [selectedName, setSelectedName] = useState(loaded.entries[0]?.name)
  const selected = loaded.entries.find((entry) => entry.name === selectedName)
  const names = new Map(loaded.items.map((item) => [item.xmlFileName, item.productName ?? item.productNumber]))
  const count = (kind: ShaiEntry['kind']) => loaded.entries.filter((entry) => entry.kind === kind).length

  return <ViewerFrame stage="分割前" title={loaded.sourceName} fileName="ZIP形式" meta={`${loaded.entries.length} ファイル ／ ${loaded.sourceSize.toLocaleString()} バイト`} onClose={onClose}>
    <div className="zip-summary">
      <span><b>{count('item')}</b> 品目XML（分割対象）</span>
      {count('excluded') > 0 && <span className="warn"><b>{count('excluded')}</b> 除外したXML</span>}
      {count('other') > 0 && <span className="muted"><b>{count('other')}</b> 対象外のファイル</span>}
    </div>
    <div className="table-wrap entries"><table><thead><tr><th>No.</th><th>種類</th><th>ZIP内のファイル名</th><th>製品名</th><th>サイズ</th><th>更新日時</th></tr></thead><tbody>
      {loaded.entries.map((entry, index) => <tr key={entry.name} className={entry.name === selectedName ? 'selected' : ''} onClick={() => setSelectedName(entry.name)}>
        <td>{index + 1}</td>
        <td><span className={`kind ${entry.kind}`}>{KIND_LABELS[entry.kind]}</span></td>
        <td className="filename"><button className="link" aria-pressed={entry.name === selectedName} onClick={() => setSelectedName(entry.name)}>{entry.name}</button></td>
        <td>{names.get(entry.name) ?? '—'}</td>
        <td className="num">{entry.size.toLocaleString()} B</td>
        <td>{entry.date.toLocaleString('ja-JP')}</td>
      </tr>)}
    </tbody></table></div>
    {selected && <div className="entry-content">
      <h3>{selected.name}</h3>
      <EntryContent key={selected.name} entry={selected} />
    </div>}
  </ViewerFrame>
}
