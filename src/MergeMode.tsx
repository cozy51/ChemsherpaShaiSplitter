import { useCallback, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { LoadedShai, ShaiItem } from './types'
import { readShaiFile } from './services/shaiReader'
import { defaultMergedName, mergeShaiItems, mergedFileNameOf } from './services/shaiMerger'
import { createExcel, excelFileNameOf } from './services/excelExport'
import { downloadBlob } from './utils/download'
import ShaiViewer from './ShaiViewer'

type BusyState = 'reading' | 'merging' | 'excel' | null

/** 結合元の1ファイル分です。品目のidはファイルをまたいで重ならないよう付け直します。 */
interface Source {
  key: string
  loaded: LoadedShai
}

interface Merged {
  fileName: string
  blob: Blob
  /** 作成した .shai を読み直した結果です。中身の確認とExcel出力に使います。 */
  loaded: LoadedShai
  warnings: string[]
}

/** 複数の .shai から品目を選び、1つの .shai にまとめる画面です。 */
export default function MergeMode() {
  const inputRef = useRef<HTMLInputElement>(null)
  const counter = useRef(0)
  const [sources, setSources] = useState<Source[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [name, setName] = useState(defaultMergedName)
  const [merged, setMerged] = useState<Merged | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState<BusyState>(null)
  const [dragging, setDragging] = useState(false)
  const [viewing, setViewing] = useState<LoadedShai | null>(null)
  const closeViewer = useCallback(() => setViewing(null), [])

  const items = sources.flatMap((source) => source.loaded.items.map((item) => ({ source, item })))

  async function add(files: File[]) {
    if (files.length === 0) return
    setBusy('reading'); setErrors([]); setMerged(null)
    const added: Source[] = []
    const failed: string[] = []
    for (const file of files) {
      try {
        const loaded = await readShaiFile(file)
        counter.current += 1
        const key = `source-${counter.current}`
        added.push({ key, loaded: { ...loaded, items: loaded.items.map((item) => ({ ...item, id: `${key}/${item.id}` })) } })
      } catch (reason) {
        failed.push(`${file.name}: ${reason instanceof Error ? reason.message : '読み込みに失敗しました。'}`)
      }
    }
    setSources((current) => [...current, ...added])
    setSelected((current) => new Set([...current, ...added.flatMap((source) => source.loaded.items.map((item) => item.id))]))
    setErrors(failed)
    setBusy(null)
  }

  function remove(key: string) {
    setSources((current) => current.filter((source) => source.key !== key))
    setSelected((current) => new Set([...current].filter((id) => !id.startsWith(`${key}/`))))
    setMerged(null)
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setMerged(null)
  }

  function setAll(checked: boolean) {
    setSelected(checked ? new Set(items.map(({ item }) => item.id)) : new Set())
    setMerged(null)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragging(false); void add(Array.from(event.dataTransfer.files))
  }

  async function merge() {
    const targets: ShaiItem[] = items.filter(({ item }) => selected.has(item.id)).map(({ item }) => item)
    if (targets.length < 2) return
    setBusy('merging'); setErrors([]); setMerged(null)
    try {
      const fileName = mergedFileNameOf(name)
      const result = await mergeShaiItems(targets)
      const loaded = await readShaiFile(new File([result.blob], fileName))
      setMerged({ fileName, blob: result.blob, loaded, warnings: [...result.warnings, ...loaded.warnings] })
    } catch {
      setErrors(['結合処理に失敗しました。もう一度お試しください。'])
    } finally { setBusy(null) }
  }

  async function exportExcel(loaded: LoadedShai) {
    setBusy('excel'); setErrors([])
    try { downloadBlob(await createExcel(loaded.items, loaded.sourceName), excelFileNameOf(loaded.sourceName)) }
    catch { setErrors(['Excelファイルの作成に失敗しました。']) }
    finally { setBusy(null) }
  }

  const allSelected = items.length > 0 && selected.size === items.length
  const canMerge = selected.size >= 2
  const busyLabel = busy === 'reading' ? '読み込み中…' : busy === 'merging' ? '結合処理中…' : 'Excelファイルを作成中…'

  return <>
    <section className="card upload-card">
      <div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
        <div className="upload-icon">⇧</div><h3>結合する .shai ファイルをここにドロップ</h3><p>複数のファイルをまとめて選べます。あとから追加することもできます。</p>
        <button className="primary" onClick={() => inputRef.current?.click()} disabled={!!busy}>ファイルを選択</button>
        <input ref={inputRef} type="file" accept=".shai" multiple hidden onChange={(e) => { void add(Array.from(e.target.files ?? [])); e.target.value = '' }}/>
        <small>ファイルは外部へ送信されません。すべてこのブラウザ内で処理します。</small>
      </div>
    </section>

    {busy && <div className="notice processing" role="status"><span className="spinner"/>{busyLabel}</div>}
    {errors.map((error) => <div className="notice error" role="alert" key={error}>⚠ <span>{error}</span></div>)}

    {sources.length > 0 && <section className="card result-card">
      <div className="section-head"><div><span className="step">STEP 2</span><h2>結合する品目</h2></div><button className="secondary" onClick={() => inputRef.current?.click()} disabled={!!busy}>＋ ファイルを追加</button></div>
      <ul className="source-list">
        {sources.map((source) => <li key={source.key}>
          <span className="file-symbol">S</span><div><b>{source.loaded.sourceName}</b><span>{source.loaded.items.length} 品目</span></div>
          <button className="secondary small" onClick={() => setViewing(source.loaded)}>🔍 中身を見る</button>
          <button className="link remove" onClick={() => remove(source.key)} disabled={!!busy} aria-label={`${source.loaded.sourceName}を外す`}>✕ 外す</button>
        </li>)}
      </ul>
      {sources.flatMap((source) => source.loaded.warnings.map((warning) => <div className="notice warning" key={source.key + warning}>⚠ <span>{source.loaded.sourceName}: {warning}</span></div>))}
      <div className="selection-bar">
        <label><input type="checkbox" checked={allSelected} onChange={() => setAll(!allSelected)}/> 全選択</label>
        <button className="link" onClick={() => setAll(false)}>全解除</button><span>{selected.size} / {items.length} 件を選択中</span>
      </div>
      <div className="table-wrap"><table><thead><tr><th>No.</th><th>選択</th><th>製品名</th><th>製品品番</th><th>元ファイル</th><th>XMLファイル名</th></tr></thead><tbody>
        {items.map(({ source, item }, index) => <tr key={item.id}><td>{index + 1}</td><td><input aria-label={`${item.productName ?? item.productNumber}を選択`} type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)}/></td><td><b>{item.productName ?? '—'}</b></td><td>{item.productNumber}</td><td>{source.loaded.sourceName}</td><td className="filename">{item.xmlFileName}</td></tr>)}
      </tbody></table></div>
      <div className="action-row">
        <label className="name-field">結合後のファイル名<span><input type="text" value={name} onChange={(event) => { setName(event.target.value); setMerged(null) }} />.shai</span></label>
        <button className="primary large" onClick={() => void merge()} disabled={!!busy || !canMerge}>{canMerge ? `選択した ${selected.size} 品目を結合　→` : '結合できません'}</button>
        {!canMerge && <p className="disabled-reason">結合するには2品目以上を選択してください。</p>}
      </div>
    </section>}

    {merged && <section className="card downloads">
      <div className="section-head"><div><span className="step done">✓ COMPLETE</span><h2>結合結果</h2><p className="success">{merged.loaded.items.length}品目を1つのSHAlファイルにまとめました。</p></div></div>
      {merged.warnings.map((warning) => <div className="notice warning" key={warning}>⚠ <span>{warning}</span></div>)}
      <div className="download-list"><div><span className="zip-icon">S</span><b>{merged.fileName}</b>
        <button className="secondary" onClick={() => setViewing(merged.loaded)}>🔍 中身を見る</button>
        <button className="secondary" onClick={() => void exportExcel(merged.loaded)} disabled={!!busy}>📊 Excel</button>
        <button className="primary" onClick={() => downloadBlob(merged.blob, merged.fileName)}>⇩ ダウンロード</button>
      </div></div>
    </section>}

    {viewing && <ShaiViewer loaded={viewing} onClose={closeViewer} />}
  </>
}
