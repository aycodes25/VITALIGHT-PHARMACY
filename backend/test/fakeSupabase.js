// Minimal chainable stand-in for the Supabase client.
// results: { [table]: { data, error } } returned when a chain is awaited or ends in single()/maybeSingle().
export function fakeSupabase({ user = null, results = {} } = {}) {
  const calls = []

  function from(table) {
    const callIndex = calls.filter((call) => call.table === table).length
    const state = { table, ops: [] }
    calls.push(state)
    // A function entry gets the number of earlier queries on this table (0 for the first).
    const result = () => {
      const entry = results[table]
      if (typeof entry === 'function') return entry(callIndex)
      return entry ?? { data: [], error: null }
    }
    const chain = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'then') return (resolve, reject) => Promise.resolve(result()).then(resolve, reject)
        return (...args) => {
          state.ops.push([prop, args])
          if (prop === 'single' || prop === 'maybeSingle') {
            const value = result()
            return Promise.resolve(Array.isArray(value.data) ? { ...value, data: value.data[0] ?? null } : value)
          }
          return chain
        }
      },
    })
    return chain
  }

  return {
    calls,
    from,
    auth: {
      async getUser(token) {
        if (user && token === 'good-token') return { data: { user }, error: null }
        return { data: { user: null }, error: { message: 'invalid' } }
      },
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: (objectPath) => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/product-images/${objectPath}` } }),
      }),
    },
  }
}
