export function bearerToken(req) {
  const header = req.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

// Resolves the signed-in customer from the request, or null for guests and bad tokens.
export async function customerFromRequest(supabase, req) {
  const token = bearerToken(req)
  if (!supabase || !token) return null
  try {
    const { data, error } = await supabase.auth.getUser(token)
    return error || !data?.user ? null : { id: data.user.id, email: data.user.email }
  } catch {
    return null
  }
}
