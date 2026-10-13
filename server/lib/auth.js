export function parseAdminEmails(value = '') {
  return new Set(
    value.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean),
  )
}

export function createAuth({ supabase, admins }) {
  const notConfigured = {
    error: 'The admin API is not configured. Add Supabase server credentials to the server environment.',
  }

  function requireDatabase(_req, res, next) {
    if (!supabase) return res.status(503).json(notConfigured)
    return next()
  }

  async function requireAdmin(req, res, next) {
    if (!supabase) return res.status(503).json(notConfigured)
    if (admins.size === 0) {
      return res.status(503).json({ error: 'Admin access is not configured. Add an approved email to ADMIN_EMAILS.' })
    }

    const authorization = req.get('authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    if (!token) {
      return res.status(401).json({ error: 'Sign in with an approved admin account to continue.' })
    }

    try {
      const { data, error } = await supabase.auth.getUser(token)
      const user = data?.user
      if (error || !user || !user.email) {
        return res.status(401).json({ error: 'Your admin session is invalid or expired. Sign in again.' })
      }
      if (!user.email_confirmed_at || !admins.has(user.email.toLowerCase())) {
        return res.status(403).json({ error: 'This account is not authorised to manage the pharmacy.' })
      }
      req.admin = { id: user.id, email: user.email }
      return next()
    } catch (error) {
      console.error('Unable to verify admin session:', error.message)
      return res.status(503).json({ error: 'Admin sign-in could not be verified. Please try again shortly.' })
    }
  }

  return { requireDatabase, requireAdmin }
}
