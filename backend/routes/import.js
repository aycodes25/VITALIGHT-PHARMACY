import { Router } from 'express'
import { approveItem } from '../lib/import/approve.js'
import { findDuplicate, suggestCategory } from '../lib/import/match.js'
import { scanStep } from '../lib/import/scanner.js'
import { ImportError, assertPublicUrl } from '../lib/import/urlSafety.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MIGRATION_MESSAGE = 'The AI import tables are missing. Apply supabase/migrations/005_import_queue.sql in the Supabase SQL editor.'
const ALREADY_HANDLED = 'This product was already approved or rejected, or no longer exists.'

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const MAX_URL_LENGTH = 2000
const ITEM_LIMIT = 500

const missingTable = (error) => error?.code === '42P01' || error?.code === 'PGRST205'

function sendError(res, error, fallback) {
  if (error instanceof ImportError) return res.status(error.status).json({ error: error.message })
  if (missingTable(error)) return res.status(503).json({ error: MIGRATION_MESSAGE })
  console.error(`${fallback} ${error?.message ?? error}`)
  return res.status(500).json({ error: fallback })
}

export function importRoutes({ supabase, supabaseUrl, auth, fetchOpts = {} }) {
  const router = Router()
  const guard = auth.requireAdmin

  router.post('/scan', guard, async (req, res) => {
    const { url, batchId } = isPlainObject(req.body) ? req.body : {}
    let createdBatchId = null
    try {
      let batch
      if (batchId !== undefined) {
        if (typeof batchId !== 'string' || !UUID.test(batchId)) return res.status(400).json({ error: 'Invalid scan.' })
        const { data, error } = await supabase.from('import_batches').select('*').eq('id', batchId).maybeSingle()
        if (error) throw error
        if (!data) return res.status(404).json({ error: 'This scan no longer exists.' })
        if (data.status === 'ready') return res.json({ batchId: data.id, added: 0, done: true, platform: data.platform, limitReached: false })
        batch = data
      } else {
        if (typeof url !== 'string' || !url.trim()) return res.status(400).json({ error: 'Paste the website address you want to scan.' })
        if (url.trim().length > MAX_URL_LENGTH) return res.status(400).json({ error: 'That website address is too long.' })
        await assertPublicUrl(url.trim(), fetchOpts)
        const { data, error } = await supabase.from('import_batches')
          .insert({ source_url: url.trim(), status: 'scanning' })
          .select('*')
          .single()
        if (error) throw error
        batch = data
        createdBatchId = data.id
      }

      const step = await scanStep({ url: batch.source_url, cursor: batch.cursor ?? null }, fetchOpts)
      if (step.items.length) {
        const { error } = await supabase.from('import_items').insert(step.items.map((data) => ({ batch_id: batch.id, data })))
        if (error) throw error
      }
      const { error: updateError } = await supabase.from('import_batches')
        .update({ platform: step.platform, cursor: step.cursor, status: step.cursor ? 'scanning' : 'ready' })
        .eq('id', batch.id)
      if (updateError) throw updateError
      return res.json({ batchId: batch.id, added: step.items.length, done: !step.cursor, platform: step.platform, limitReached: step.limitReached })
    } catch (error) {
      // Items cascade with the batch, so a failed first step leaves nothing half-created.
      if (createdBatchId) await Promise.resolve(supabase.from('import_batches').delete().eq('id', createdBatchId)).catch(() => {})
      return sendError(res, error, 'The website could not be scanned.')
    }
  })

  router.get('/batches', guard, async (_req, res) => {
    try {
      const { data, error } = await supabase.from('import_batches')
        .select('id, source_url, platform, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return res.json({ batches: data })
    } catch (error) {
      return sendError(res, error, 'Recent scans could not be loaded.')
    }
  })

  router.get('/batches/:id', guard, async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Invalid scan.' })
    try {
      const [batchResult, itemsResult, categoriesResult, productsResult] = await Promise.all([
        supabase.from('import_batches').select('id, source_url, platform, status, created_at').eq('id', req.params.id).maybeSingle(),
        supabase.from('import_items').select('*').eq('batch_id', req.params.id).order('created_at', { ascending: true }).order('id', { ascending: true }).limit(ITEM_LIMIT + 1),
        supabase.from('categories').select('name'),
        supabase.from('products').select('id, name').limit(5000),
      ])
      for (const { error } of [batchResult, itemsResult, categoriesResult, productsResult]) if (error) throw error
      if (!batchResult.data) return res.status(404).json({ error: 'This scan no longer exists.' })
      const categories = categoriesResult.data ?? []
      const products = productsResult.data ?? []
      const rows = itemsResult.data ?? []
      return res.json({
        batch: batchResult.data,
        truncated: rows.length > ITEM_LIMIT,
        items: rows.slice(0, ITEM_LIMIT).map((row) => ({
          id: row.id,
          status: row.status,
          product_id: row.product_id,
          data: row.data,
          suggested_category: suggestCategory(row.data, categories),
          duplicate: findDuplicate(row.data, products)?.name ?? null,
        })),
      })
    } catch (error) {
      return sendError(res, error, 'The scanned products could not be loaded.')
    }
  })

  router.post('/items/:id/approve', guard, async (req, res) => {
    const { id } = req.params
    if (!UUID.test(id)) return res.status(400).json({ error: 'Invalid product.' })
    if (!isPlainObject(req.body)) return res.status(400).json({ error: 'Send the product details to approve.' })
    let claimed = false
    try {
      // Claim first so a double click cannot create the product twice.
      const { data: item, error } = await supabase.from('import_items')
        .update({ status: 'approved' })
        .eq('id', id)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle()
      if (error) throw error
      if (!item) return res.status(409).json({ error: ALREADY_HANDLED })
      claimed = true
      const { product, warnings } = await approveItem({ supabase, supabaseUrl, item, edits: req.body, fetchOpts })
      claimed = false
      // The product is already saved; a failed link must not report failure or requeue the item.
      await Promise.resolve(supabase.from('import_items').update({ product_id: product.id }).eq('id', id)).catch(() => {})
      return res.status(201).json({ product, warnings })
    } catch (error) {
      if (claimed) await Promise.resolve(supabase.from('import_items').update({ status: 'pending' }).eq('id', id)).catch(() => {})
      return sendError(res, error, 'The product could not be saved.')
    }
  })

  router.post('/items/:id/reject', guard, async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Invalid product.' })
    try {
      const { data, error } = await supabase.from('import_items')
        .update({ status: 'rejected' })
        .eq('id', req.params.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(409).json({ error: ALREADY_HANDLED })
      return res.json({ rejected: true })
    } catch (error) {
      return sendError(res, error, 'The product could not be rejected.')
    }
  })

  return router
}
