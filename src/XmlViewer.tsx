import { useEffect, useMemo, useState } from 'react'
import type { CheckResult, XmlNode, XmlView } from './services/xmlViewer'

type Tab = 'tree' | 'fields' | 'source'

/** 項目一覧で一度に描画する行数の上限です。 */
const FIELD_LIMIT = 1000

interface Props {
  title: string
  /** 「分割前」「分割後」の区別です。 */
  stage: string
  fileName: string
  meta: string
  view?: XmlView
  /** 指定すると、分割前のXMLへ切り替えて表示できます。 */
  beforeView?: XmlView
  beforeFileName?: string
  checks?: CheckResult[]
  loading?: boolean
  onClose: () => void
}

function TreeNode({ node, depth }: { node: XmlNode, depth: number }) {
  const head = <>
    <span className="tag">&lt;{node.name}&gt;</span>
    {node.attributes.map((attribute) => <span className="attr" key={attribute.name}><i>{attribute.name}</i>=<q>{attribute.value}</q></span>)}
    {node.text !== undefined && <span className="text">{node.text}</span>}
  </>
  if (node.children.length === 0) return <div className="tree-leaf">{head}</div>
  return <details className="tree-node" open={depth < 3}>
    <summary>{head}<small>{node.children.length}</small></summary>
    <div className="tree-children">{node.children.map((child) => <TreeNode key={child.path} node={child} depth={depth + 1} />)}</div>
  </details>
}

export default function XmlViewer({ title, stage, fileName, meta, view: stageView, beforeView, beforeFileName, checks, loading, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('tree')
  const [query, setQuery] = useState('')
  const [showBefore, setShowBefore] = useState(false)
  const view = showBefore && beforeView ? beforeView : stageView

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fields = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const all = view?.fields ?? []
    return keyword === '' ? all : all.filter((field) => `${field.path} ${field.name} ${field.value}`.toLowerCase().includes(keyword))
  }, [view, query])

  return <div className="viewer-backdrop" onClick={onClose}>
    <div className="viewer" role="dialog" aria-modal="true" aria-labelledby="viewer-title" onClick={(event) => event.stopPropagation()}>
      <div className="viewer-head">
        <div><span className={`stage ${stage === '分割後' ? 'after' : ''}`}>{stage}</span><h2 id="viewer-title">{title}</h2><p><span className="filename">{fileName}</span>　{meta}</p></div>
        <button className="secondary" onClick={onClose} aria-label="閉じる">✕ 閉じる</button>
      </div>

      {checks && checks.length > 0 && <ul className="checks">
        {checks.map((check) => <li key={check.label} className={check.ok ? 'ok' : 'ng'}><b>{check.ok ? '✓' : '✕'} {check.label}</b><span>{check.detail}</span></li>)}
      </ul>}

      {loading && <div className="notice processing" role="status"><span className="spinner"/>読み込み中…</div>}
      {view?.parseError && <div className="notice error" role="alert">⚠ <span>XMLとして解析できなかったため、ソースのみ表示します。</span></div>}

      {beforeView && stageView && <div className="data-switch" role="group" aria-label="表示するXML">
        <span>表示するXML</span>
        <button className={!showBefore ? 'active after' : ''} aria-pressed={!showBefore} onClick={() => setShowBefore(false)}>分割後 <small>{fileName}</small></button>
        <button className={showBefore ? 'active' : ''} aria-pressed={showBefore} onClick={() => setShowBefore(true)}>分割前 <small>{beforeFileName}</small></button>
      </div>}

      {view && <>
        <div className="viewer-tabs" role="tablist">
          {!view.parseError && <button role="tab" aria-selected={tab === 'tree'} className={tab === 'tree' ? 'active' : ''} onClick={() => setTab('tree')}>構造ツリー</button>}
          {!view.parseError && <button role="tab" aria-selected={tab === 'fields'} className={tab === 'fields' ? 'active' : ''} onClick={() => setTab('fields')}>項目一覧 <small>{view.fields.length.toLocaleString()}</small></button>}
          <button role="tab" aria-selected={tab === 'source' || view.parseError} className={tab === 'source' || view.parseError ? 'active' : ''} onClick={() => setTab('source')}>XMLソース</button>
        </div>
        <div className="viewer-body">
          {view.parseError || tab === 'source'
            ? <pre className="xml-source">{view.source}</pre>
            : tab === 'tree' && view.root
              ? <div className="tree"><TreeNode node={view.root} depth={0} /></div>
              : <>
                <input className="field-search" type="search" placeholder="項目名・値・パスで絞り込み" value={query} onChange={(event) => setQuery(event.target.value)} />
                <div className="table-wrap"><table className="fields"><thead><tr><th>No.</th><th>パス</th><th>項目</th><th>値</th></tr></thead><tbody>
                  {fields.slice(0, FIELD_LIMIT).map((field, index) => <tr key={`${field.path}|${field.name}`}><td>{index + 1}</td><td className="filename">{field.path}</td><td><b>{field.name}</b></td><td className="value">{field.value}</td></tr>)}
                </tbody></table></div>
                {fields.length > FIELD_LIMIT && <p className="more">先頭 {FIELD_LIMIT.toLocaleString()} 件を表示しています（全 {fields.length.toLocaleString()} 件）。絞り込みで対象を指定してください。</p>}
                {fields.length === 0 && <p className="more">該当する項目がありません。</p>}
              </>}
        </div>
      </>}
    </div>
  </div>
}
