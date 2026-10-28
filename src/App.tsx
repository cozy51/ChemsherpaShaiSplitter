import { useCallback, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { LoadedShai, ShaiItem, SplitFile } from './types'
import { readShaiFile } from './services/shaiReader'
import { createBundle, createSplitFiles } from './services/shaiWriter'
import { inspectSplitFile } from './services/xmlViewer'
import { createExcel, excelFileNameOf } from './services/excelExport'
import type { CheckResult, XmlView } from './services/xmlViewer'
import { downloadBlob } from './utils/download'
import AppMark from './AppMark'
import XmlViewer from './XmlViewer'
import ShaiViewer from './ShaiViewer'
import MergeMode from './MergeMode'

type BusyState = 'reading' | 'splitting' | 'bundling' | 'excel' | null
type Mode = 'split' | 'merge'

interface ViewerState {
  item: ShaiItem
  fileName: string
  meta: string
  view?: XmlView
  checks?: CheckResult[]
  loading?: boolean
}

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('split')
  const [loaded, setLoaded] = useState<LoadedShai | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<SplitFile[]>([])
  const [error, setError] = useState('')
  const [complete, setComplete] = useState('')
  const [busy, setBusy] = useState<BusyState>(null)
  const [dragging, setDragging] = useState(false)
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  const [sourceViewerOpen, setSourceViewerOpen] = useState(false)
  const closeViewer = useCallback(() => setViewer(null), [])
  const closeSourceViewer = useCallback(() => setSourceViewerOpen(false), [])

  async function load(file?: File) {
    if (!file) return
    setError(''); setComplete(''); setResults([]); setSourceViewerOpen(false); setBusy('reading')
    try {
      const next = await readShaiFile(file)
      setLoaded(next)
      setSelected(new Set(next.items.map((item) => item.id)))
    } catch (reason) {
      setLoaded(null); setSelected(new Set())
      setError(reason instanceof Error ? reason.message : 'ファイルの読み込みに失敗しました。')
    } finally { setBusy(null) }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragging(false); void load(event.dataTransfer.files[0])
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setResults([]); setComplete('')
  }

  function setAll(checked: boolean) {
    setSelected(checked && loaded ? new Set(loaded.items.map((item) => item.id)) : new Set())
    setResults([]); setComplete('')
  }

  async function split() {
    if (!loaded || selected.size === 0) return
    setBusy('splitting'); setError(''); setComplete(''); setResults([])
    try {
      const files = await createSplitFiles(loaded.items.filter((item) => selected.has(item.id)))
      setResults(files)
      setComplete(`${files.length}件のSHAlファイルを作成しました。`)
    } catch {
      setError('分割処理に失敗しました。もう一度お試しください。')
    } finally { setBusy(null) }
  }

  async function downloadAll() {
    setBusy('bundling'); setError('')
    try { downloadBlob(await createBundle(results), 'SHAI_split.zip') }
    catch { setError('まとめファイルの作成に失敗しました。') }
    finally { setBusy(null) }
  }

  async function exportExcel(items: ShaiItem[], sourceName: string) {
    setBusy('excel'); setError('')
    try { downloadBlob(await createExcel(items, sourceName), excelFileNameOf(sourceName)) }
    catch { setError('Excelファイルの作成に失敗しました。') }
    finally { setBusy(null) }
  }

  async function viewAfter(file: SplitFile) {
    const item = loaded?.items.find((candidate) => candidate.id === file.id)
    if (!item) return
    const base = { item, fileName: file.fileName, meta: `格納XML: ${item.xmlFileName}` }
    setViewer({ ...base, loading: true })
    const inspection = await inspectSplitFile(file.blob, item)
    setViewer((current) => current?.item === item ? { ...base, view: inspection.view, checks: inspection.checks } : current)
  }

  const allSelected = !!loaded && selected.size === loaded.items.length
  // 1品目だけのファイルは分割しても同じ内容になるため、分割できないようにします。
  const singleItem = loaded?.items.length === 1
  const busyLabel = busy === 'reading' ? '読み込み中…' : busy === 'splitting' ? '分割処理中…' : busy === 'excel' ? 'Excelファイルを作成中…' : 'まとめファイルを作成中…'

  return <>
    <header><div className="header-inner"><AppMark className="mark" /><div><h1>SHAlファイル分割</h1><p>品目ごとに安全・かんたん分割</p></div><span className="local-badge">● ブラウザ内で処理</span></div></header>
    <main>
      <section className="intro">
        {mode === 'split'
          ? <div><span className="eyebrow">SHAl SPLITTER</span><h2>複数品目を、<br/><strong>1品目ずつのファイルへ。</strong></h2><p>ファイルを選ぶだけで、XMLを変更せずに品目ごとのSHAlを作成します。ファイル名は製品名で保存されます。</p></div>
          : <div><span className="eyebrow">SHAl MERGER</span><h2>複数のファイルを、<br/><strong>1つのファイルへ。</strong></h2><p>複数のSHAlから品目を選び、XMLを変更せずに1つのSHAlにまとめます。</p></div>}
        <ol><li><b>1</b> ファイルを選択</li><li><b>2</b> 品目を確認・選択</li><li><b>3</b> {mode === 'split' ? '分割' : '結合'}してダウンロード</li></ol>
      </section>

      <div className="mode-switch" role="tablist" aria-label="モード">
        <button role="tab" aria-selected={mode === 'split'} className={mode === 'split' ? 'active' : ''} onClick={() => setMode('split')} disabled={!!busy}>✂ 分割<small>1つのファイルを品目ごとに分ける</small></button>
        <button role="tab" aria-selected={mode === 'merge'} className={mode === 'merge' ? 'active' : ''} onClick={() => setMode('merge')} disabled={!!busy}>🔗 結合<small>複数のファイルを1つにまとめる</small></button>
      </div>

      <section className="card about" aria-labelledby="about-shai">
        <AppMark className="about-mark" />
        <div>
          <h3 id="about-shai">SHAIファイルとは？</h3>
          <p>SHAIファイルは、chemSHERPA-AI（成形品）で使用する製品含有化学物質情報のデータファイルです。製品・部品の構成や材質、含有化学物質などの情報が保存されています。</p>
          <p>このアプリでは、複数の品目を含むSHAIファイルを読み込み、品目ごとに分割して個別のSHAIファイルとして出力できます。「結合」に切り替えると、複数のSHAIファイルを1つにまとめることもできます。</p>
        </div>
      </section>

      {mode === 'merge' ? <MergeMode /> : <>
      <section className="card upload-card">
        <div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
          <div className="upload-icon">⇧</div><h3>.shai ファイルをここにドロップ</h3><p>または</p>
          <button className="primary" onClick={() => inputRef.current?.click()} disabled={!!busy}>ファイルを選択</button>
          <input ref={inputRef} type="file" accept=".shai" hidden onChange={(e) => void load(e.target.files?.[0])}/>
          <small>ファイルは外部へ送信されません。すべてこのブラウザ内で処理します。</small>
        </div>
      </section>

      {busy && <div className="notice processing" role="status"><span className="spinner"/>{busyLabel}</div>}
      {error && <div className="notice error" role="alert">⚠ <span>{error}</span></div>}

      {loaded && <section className="card result-card">
        <div className="section-head"><div><span className="step">STEP 2</span><h2>読み込み結果</h2></div><button className="secondary" onClick={() => { if (inputRef.current) inputRef.current.value = ''; inputRef.current?.click() }} disabled={!!busy}>↻ ファイルを選び直す</button></div>
        <div className="file-summary"><div className="file-symbol">XML</div><div><span>読み込んだファイル</span><b>{loaded.sourceName}</b></div><strong>{loaded.items.length}<small> 品目</small></strong><button className="secondary small" onClick={() => setSourceViewerOpen(true)}>🔍 中身を見る</button><button className="secondary small" onClick={() => void exportExcel(loaded.items, loaded.sourceName)} disabled={!!busy}>📊 Excel出力</button></div>
        {loaded.warnings.map((warning) => <div className="notice warning" key={warning}>⚠ <span>{warning}</span></div>)}
        <div className="selection-bar">
          <label><input type="checkbox" checked={allSelected} onChange={() => setAll(!allSelected)}/> 全選択</label>
          <button className="link" onClick={() => setAll(false)}>全解除</button><span>{selected.size} / {loaded.items.length} 件を選択中</span>
        </div>
        <div className="table-wrap"><table><thead><tr><th>No.</th><th>選択</th><th>製品名</th><th>製品品番</th><th>XMLファイル名</th></tr></thead><tbody>
          {loaded.items.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><input aria-label={`${item.productName ?? item.productNumber}を選択`} type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)}/></td><td><b>{item.productName ?? '—'}</b></td><td>{item.productNumber}</td><td className="filename">{item.xmlFileName}</td></tr>)}
        </tbody></table></div>
        <div className="action-row">
          <button className="primary large" onClick={() => void split()} disabled={!!busy || selected.size === 0 || singleItem}>{singleItem ? '分割できません' : `選択した ${selected.size} 品目を分割　→`}</button>
          {singleItem && <p className="disabled-reason">このファイルは1品目だけのため、分割の必要はありません。中身の確認やExcel出力はそのまま行えます。</p>}
          {!singleItem && selected.size === 0 && <p className="disabled-reason">分割する品目を1つ以上選択してください。</p>}
        </div>
      </section>}

      {results.length > 0 && <section className="card downloads">
        <div className="section-head"><div><span className="step done">✓ COMPLETE</span><h2>分割結果</h2><p className="success">{complete}</p></div></div>
        <div className="download-list">{results.map((file) => <div key={file.id}><span className="zip-icon">S</span><b>{file.fileName}</b><button className="secondary view-button" onClick={() => void viewAfter(file)}>🔍 内容を確認</button><button className="secondary" onClick={() => { const item = loaded?.items.find((candidate) => candidate.id === file.id); if (item) void exportExcel([item], file.fileName) }} disabled={!!busy}>📊 Excel</button><button className="secondary" onClick={() => downloadBlob(file.blob, file.fileName)}>⇩ ダウンロード</button></div>)}</div>
        <div className="bundle"><div><b>すべてのファイルを一括保存</b><span>分割後のSHAlを1つのZIPにまとめます</span></div><button className="primary" onClick={() => void downloadAll()} disabled={!!busy}>⇩ すべてまとめてダウンロード</button></div>
      </section>}
      </>}
    </main>
    {viewer && <XmlViewer title={viewer.item.productName ?? viewer.item.productNumber} fileName={viewer.fileName} meta={viewer.meta} view={viewer.view} checks={viewer.checks} loading={viewer.loading} onClose={closeViewer} />}
    {sourceViewerOpen && loaded && <ShaiViewer loaded={loaded} onClose={closeSourceViewer} />}
    <footer>このツールは完全にクライアントサイドで動作します。ファイルがサーバーへ送信されることはありません。</footer>
  </>
}
