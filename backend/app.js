import express from 'express'
import path from 'node:path'
import { createAuth } from './lib/auth.js'
import { publicRoutes } from './routes/public.js'
import { adminRoutes } from './routes/admin.js'
import { accountRoutes } from './routes/account.js'

export function createApp({ supabase = null, supabaseUrl = '', admins = new Set(), starter, clientDistPath }) {
  const app = express()
  const auth = createAuth({ supabase, admins })

  app.disable('x-powered-by')
  app.use(express.json({ limit: '32kb' }))

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      supabaseConfigured: Boolean(supabase),
      adminConfigured: Boolean(supabase && admins.size),
    })
  })

  app.use('/api', publicRoutes({ supabase, starter }))
  app.use('/api/account', accountRoutes({ supabase }))
  app.use('/api/admin', adminRoutes({ supabase, supabaseUrl, auth }))
  app.use('/api/admin', auth.requireDatabase)
  app.use('/api/admin', (_req, res) => res.status(404).json({ error: 'Admin endpoint not found.' }))

  app.use(express.static(clientDistPath))
  app.get('*path', (_req, res) => {
    res.sendFile(path.resolve(clientDistPath, 'index.html'), (error) => {
      if (error && !res.headersSent) {
        res.status(404).send('Build the storefront with npm run build before starting the production server.')
      }
    })
  })

  return app
}
