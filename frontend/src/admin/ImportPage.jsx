import { useCallback, useEffect, useRef, useState } from 'react'
import { formatPrice } from '../../../shared/money.js'
import { draftFromItem, itemProblems, payloadFromDraft, safeHttpUrl, summarize } from './importHelpers.js'

const MAX_SCAN_STEPS = 60
const base = '/api/admin/import'

function ImportCard({ item, draft, label, categories, editing, busy, onChange, onToggleEdit, onApprove, onReject }) {
  const problems = itemProblems(draft)
  const pending = item.status === 'pending'
  const set = (key) => (event) => onChange({ ...draft, [key]: event.target.value })
  const name = label
  const images = draft.images.filter((src) => safeHttpUrl(src))
  const sourceUrl = safeHttpUrl(item.data.source_url)
  return (
    <article className={`import-card import-${item.status}`}>
      <div className="import-card-media">
        {images.length
          ? images.map((src) => (
            <span className="import-thumb" key={src}>
              <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
              {editing && pending && <button type="button" aria-label={`Remove photo from ${name}`} onClick={() => onChange({ ...draft, images: draft.images.filter((url) => url !== src) })}>×</button>}
            </span>
          ))
          : <span className="import-no-photo">No photo found</span>}
      </div>
      <div className="import-card-body">
        {!pending && <span className={`import-status import-status-${item.status}`}>{item.status === 'approved' ? 'Approved' : 'Rejected'}</span>}
        {item.duplicate && pending && <span className="import-duplicate">Already in your store as “{item.duplicate}”</span>}
        {editing && pending ? (
          <div className="import-edit-grid">
            <label>Name<input aria-label={`Name of ${name}`} value={draft.name} onChange={set('name')} /></label>
            <label>Price (₦)<input aria-label={`Price of ${name}`} inputMode="numeric" value={draft.price} onChange={set('price')} /></label>
            <label>Original price (₦)<input aria-label={`Original price of ${name}`} inputMode="numeric" value={draft.old_price} onChange={set('old_price')} /></label>
            <label>Brand<input aria-label={`Brand of ${name}`} value={draft.brand} onChange={set('brand')} /></label>
            <label>Badge<input aria-label={`Badge of ${name}`} value={draft.tag} onChange={set('tag')} /></label>
            <label className="import-wide">Description<textarea aria-label={`Description of ${name}`} rows={3} value={draft.detail} onChange={set('detail')} /></label>
          </div>
        ) : (
          <>
            <h3>{draft.name}</h3>
            <p className="import-price">{draft.price === '' ? 'No price found' : formatPrice(draft.price)}{draft.old_price !== '' && <s>{formatPrice(draft.old_price)}</s>}{item.data.currency && item.data.currency !== 'NGN' && <em>Site currency: {item.data.currency}</em>}</p>
            <p className="import-detail">{draft.detail || 'No description found'}</p>
          </>
        )}
        <div className="import-row">
          <label>Category
            <select aria-label={`Category for ${name}`} value={draft.category} disabled={!pending} onChange={set('category')}>
              <option value="">Choose a category</option>
              {categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
            </select>
          </label>
          <label>Stock
            <input aria-label={`Stock for ${name}`} inputMode="numeric" value={draft.stock} disabled={!pending} onChange={set('stock')} />
          </label>
        </div>
        {sourceUrl && <a className="import-source" href={sourceUrl} target="_blank" rel="noreferrer">View on source site ↗</a>}
        {pending && problems.length > 0 && <ul className="import-problems">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
        {pending && (
          <div className="import-actions">
            <button type="button" className="admin-primary-button" aria-label={`Approve ${name}`} disabled={busy || problems.length > 0} onClick={onApprove}>Approve</button>
            <button type="button" className="admin-secondary-button" aria-label={`${editing ? 'Done editing' : 'Edit'} ${name}`} disabled={busy} onClick={onToggleEdit}>{editing ? 'Done' : 'Edit'}</button>
            <button type="button" className="admin-secondary-button" aria-label={`Reject ${name}`} disabled={busy} onClick={onReject}>Reject</button>
          </div>
        )}
      </div>
    </article>
  )
}

export default function ImportPage({ authRequest, categories, onProductsChanged, setError, setMessage }) {
  const [url, setUrl] = useState('')
  const [recent, setRecent] = useState([])
  const [batch, setBatch] = useState(null)
  const [items, setItems] = useState([])
  const [drafts, setDrafts] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [scanned, setScanned] = useState(false)
  const busyRef = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Parent callbacks must not fire once the page has been left.
  const fail = useCallback((text) => { if (mounted.current) setError(text) }, [setError])
  const note = useCallback((text) => { if (mounted.current) setMessage(text) }, [setMessage])

  const loadRecent = useCallback(async () => {
    try {
      setRecent((await authRequest(`${base}/batches`)).batches)
    } catch (loadError) {
      fail(loadError.message)
    }
  }, [authRequest, fail])

  useEffect(() => { loadRecent() }, [loadRecent])

  async function openBatch(id) {
    const result = await authRequest(`${base}/batches/${id}`)
    setBatch(result.batch)
    setItems(result.items)
    setDrafts(Object.fromEntries(result.items.map((item) => [item.id, draftFromItem(item)])))
    setEditingId(null)
  }

  async function scan(event) {
    event.preventDefault()
    fail('')
    note('')
    setScanning(true)
    setScanned(false)
    let batchId = null
    let found = 0
    let finished = false
    try {
      for (let step = 0; step < MAX_SCAN_STEPS; step += 1) {
        if (!mounted.current) return
        setProgress(found ? `Scanning… ${found} products found so far` : 'Scanning the website…')
        const result = await authRequest(`${base}/scan`, { method: 'POST', body: JSON.stringify(batchId ? { batchId } : { url: url.trim() }) })
        batchId = result.batchId
        found += result.added
        if (!mounted.current) return
        if (result.limitReached) note('Stopped at the scan limit (200 products). Scan a more specific category page to get the rest.')
        if (result.done) { finished = true; break }
      }
      if (!finished) note('The scan was stopped before the whole site was read. The products found so far are shown below.')
      await openBatch(batchId)
      if (!mounted.current) return
      setScanned(true)
      loadRecent()
    } catch (scanError) {
      fail(scanError.message)
      // The batch stays on the server, so keep what was already found reachable.
      if (batchId) {
        loadRecent()
        openBatch(batchId).then(() => setScanned(true)).catch(() => {})
      }
    } finally {
      setScanning(false)
      setProgress('')
    }
  }

  const mark = (id, status) => setItems((current) => current.map((item) => (item.id === id ? { ...item, status } : item)))

  // The single-item actions. They do not touch the busy flags, so a bulk run keeps the page locked for its whole length.
  async function approveCore(item, { refresh = true } = {}) {
    fail('')
    try {
      const result = await authRequest(`${base}/items/${item.id}/approve`, { method: 'POST', body: JSON.stringify(payloadFromDraft(drafts[item.id])) })
      mark(item.id, 'approved')
      note(result.warnings?.length ? `“${drafts[item.id].name}” was saved. ${result.warnings.join(' ')}` : `“${drafts[item.id].name}” was added to your products.`)
      if (refresh) onProductsChanged()
      return true
    } catch (approveError) {
      fail(approveError.message)
      return false
    }
  }

  async function rejectCore(item) {
    fail('')
    try {
      await authRequest(`${base}/items/${item.id}/reject`, { method: 'POST' })
      mark(item.id, 'rejected')
      return true
    } catch (rejectError) {
      fail(rejectError.message)
      return false
    }
  }

  // Runs `task` while the whole page is locked; a second action cannot start until it ends.
  async function locked(task) {
    if (busyRef.current) return false
    busyRef.current = true
    setBusy(true)
    try {
      return await task()
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const approve = (item) => locked(() => approveCore(item))
  const reject = (item) => locked(() => rejectCore(item))

  async function approveAllValid() {
    const targets = items.filter((item) => item.status === 'pending' && itemProblems(drafts[item.id]).length === 0)
    if (!targets.length) return
    const flagged = targets.filter((item) => item.duplicate).length
    const warning = flagged ? ` ${flagged} of them ${flagged === 1 ? 'is' : 'are'} flagged as already in your store.` : ''
    if (!window.confirm(`Approve ${targets.length} product${targets.length === 1 ? '' : 's'} and add them to your store?${warning}`)) return
    // A failed item stops the run; its error is already shown.
    await locked(async () => {
      let approved = 0
      try {
        for (const item of targets) {
          if (!mounted.current || !(await approveCore(item, { refresh: false }))) break
          approved += 1
        }
      } finally {
        // Refresh the product list once for the whole run, including a run that stopped part-way.
        if (approved) onProductsChanged()
      }
    })
  }

  async function rejectAllPending() {
    const targets = items.filter((item) => item.status === 'pending')
    if (!targets.length || !window.confirm(`Reject ${targets.length} pending product${targets.length === 1 ? '' : 's'}?`)) return
    await locked(async () => {
      for (const item of targets) {
        if (!mounted.current || !(await rejectCore(item))) break
      }
    })
  }

  const counts = summarize(items)
  // Same-named products get their position added so every accessible label is unique.
  const nameCounts = new Map()
  for (const item of items) {
    const key = drafts[item.id]?.name || 'product'
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1)
  }
  const labelFor = (item, position) => {
    const key = drafts[item.id]?.name || 'product'
    return nameCounts.get(key) > 1 ? `${key} (item ${position + 1})` : key
  }
  return (
    <div className="import-page">
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Scan a website</h2><p>Paste a shop or category link. Only import from sites you have permission to use, such as your suppliers.</p></div></div>
        <form className="import-scan-form" onSubmit={scan}>
          <input aria-label="Website address" type="url" required placeholder="https://supplier.example/collections/all" value={url} onChange={(event) => setUrl(event.target.value)} disabled={scanning} />
          <button className="admin-primary-button" type="submit" disabled={scanning || !url.trim()}>{scanning ? 'Scanning…' : 'Scan'}</button>
        </form>
        {progress && <p className="import-progress" role="status">{progress}</p>}
        {recent.length > 0 && (
          <div className="import-recent">
            <span>Recent scans</span>
            {recent.map((entry) => <button type="button" key={entry.id} className={batch?.id === entry.id ? 'selected' : ''} onClick={() => openBatch(entry.id).catch((openError) => fail(openError.message))}>{entry.source_url.replace(/^https?:\/\//, '')}</button>)}
          </div>
        )}
      </section>

      {batch && (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><h2>Review products</h2><p>{batch.source_url}{batch.platform ? ` · read as ${batch.platform}` : ''}</p></div>
            <div className="import-bulk">
              <button type="button" className="admin-primary-button" disabled={busy || counts.pending === 0} onClick={approveAllValid}>Approve all valid</button>
              <button type="button" className="admin-secondary-button" disabled={busy || counts.pending === 0} onClick={rejectAllPending}>Reject all</button>
            </div>
          </div>
          <div className="import-summary">
            <span><strong data-testid="import-total">{counts.total}</strong> Total products found</span>
            <span><strong data-testid="import-pending">{counts.pending}</strong> Pending</span>
            <span><strong data-testid="import-approved">{counts.approved}</strong> Approved</span>
            <span><strong data-testid="import-rejected">{counts.rejected}</strong> Rejected</span>
          </div>
          {scanned && counts.total === 0 && <p className="import-empty">No products were found on that page. Try a shop or category page, such as a /collections/ link.</p>}
          <div className="import-list">
            {items.map((item, position) => (
              <ImportCard
                key={item.id}
                item={item}
                draft={drafts[item.id]}
                label={labelFor(item, position)}
                categories={categories}
                editing={editingId === item.id}
                busy={busy}
                onChange={(next) => setDrafts((current) => ({ ...current, [item.id]: next }))}
                onToggleEdit={() => setEditingId(editingId === item.id ? null : item.id)}
                onApprove={() => approve(item)}
                onReject={() => reject(item)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
