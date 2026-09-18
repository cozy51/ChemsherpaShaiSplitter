import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { LoadedShai, SplitFile } from './types'
import { readShaiFile } from './services/shaiReader'
import { createBundle, createSplitFiles } from './services/shaiWriter'
import { downloadBlob } from './utils/download'

type BusyState = 'reading' | 'splitting' | 'bundling' | null

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState<LoadedShai | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<SplitFile[]>([])
  const [error, setError] = useState('')
  const [complete, setComplete] = useState('')
  const [busy, setBusy] = useState<BusyState>(null)
  const [dragging, setDragging] = useState(false)

  async function load(file?: File) {
    if (!file) return
    setError(''); setComplete(''); setResults([]); setBusy('reading')
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

  const allSelected = !!loaded && selected.size === loaded.items.length
  const busyLabel = busy === 'reading' ? '読み込み中…' : busy === 'splitting' ? '分割処理中…' : 'まとめファイルを作成中…'

  return <>
    <header><div className="header-inner"><div className="mark">S</div><div><h1>SHAlファイル分割</h1><p>品目ごとに安全・かんたん分割</p></div><span className="local-badge">● ブラウザ内で処理</span></div></header>
    <main>
      <section className="intro">
        <div><span className="eyebrow">SHAl SPLITTER</span><h2>複数品目を、<br/><strong>1品目ずつのファイルへ。</strong></h2><p>ファイルを選ぶだけで、XMLを変更せずに品目ごとのSHAlを作成します。</p></div>
        <ol><li><b>1</b> ファイルを選択</li><li><b>2</b> 品目を確認・選択</li><li><b>3</b> 分割してダウンロード</li></ol>
      </section>

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
        <div className="file-summary"><div className="file-symbol">XML</div><div><span>読み込んだファイル</span><b>{loaded.sourceName}</b></div><strong>{loaded.items.length}<small> 品目</small></strong></div>
        {loaded.warnings.map((warning) => <div className="notice warning" key={warning}>⚠ <span>{warning}</span></div>)}
        <div className="selection-bar">
          <label><input type="checkbox" checked={allSelected} onChange={() => setAll(!allSelected)}/> 全選択</label>
          <button className="link" onClick={() => setAll(false)}>全解除</button><span>{selected.size} / {loaded.items.length} 件を選択中</span>
        </div>
        <div className="table-wrap"><table><thead><tr><th>No.</th><th>選択</th><th>製品品番</th><th>XMLファイル名</th></tr></thead><tbody>
          {loaded.items.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><input aria-label={`${item.productNumber}を選択`} type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)}/></td><td><b>{item.productNumber}</b></td><td className="filename">{item.xmlFileName}</td></tr>)}
        </tbody></table></div>
        <div className="action-row"><button className="primary large" onClick={() => void split()} disabled={!!busy || selected.size === 0}>選択した {selected.size} 品目を分割　→</button></div>
      </section>}

      {results.length > 0 && <section className="card downloads">
        <div className="section-head"><div><span className="step done">✓ COMPLETE</span><h2>分割結果</h2><p className="success">{complete}</p></div></div>
        <div className="download-list">{results.map((file) => <div key={file.id}><span className="zip-icon">S</span><b>{file.fileName}</b><button className="secondary" onClick={() => downloadBlob(file.blob, file.fileName)}>⇩ ダウンロード</button></div>)}</div>
        <div className="bundle"><div><b>すべてのファイルを一括保存</b><span>分割後のSHAlを1つのZIPにまとめます</span></div><button className="primary" onClick={() => void downloadAll()} disabled={!!busy}>⇩ すべてまとめてダウンロード</button></div>
      </section>}
    </main>
    <footer>このツールは完全にクライアントサイドで動作します。ファイルがサーバーへ送信されることはありません。</footer>
  </>
}
