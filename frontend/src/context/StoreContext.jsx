import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { MAX_QUANTITY, cartLines, cartReducer, cartTotals } from '../../../shared/cart.js'
import { useCatalog } from './CatalogContext.jsx'
import { useAuth } from './AuthContext.jsx'
import { fetchProfile, saveProfile } from '../api.js'

const StoreContext = createContext(null)
const CART_KEY = 'vitalight.cart'
const SAVED_KEY = 'vitalight.saved'

function load(key, fallback, isValid) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return isValid(value) ? value : fallback
  } catch {
    return fallback
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable (private mode); the app still works in memory.
  }
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function loadCart() {
  const stored = load(CART_KEY, {}, isPlainObject)
  return Object.fromEntries(
    Object.entries(stored).filter(
      ([id, quantity]) => typeof id === 'string' && Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY,
    ),
  )
}

export function StoreProvider({ children }) {
  const { products, status } = useCatalog()
  const [cart, dispatch] = useReducer(cartReducer, undefined, loadCart)
  const [savedIds, setSaved] = useState(() => load(SAVED_KEY, [], Array.isArray))
  const [cartOpen, setCartOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const timer = useRef(null)
  const { user, session } = useAuth()
  const userId = user?.id ?? null
  const token = session?.access_token ?? ''
  const tokenRef = useRef(token)
  tokenRef.current = token
  const [synced, setSynced] = useState(false)
  const wasSignedIn = useRef(false)

  useEffect(() => save(CART_KEY, cart), [cart])
  useEffect(() => save(SAVED_KEY, savedIds), [savedIds])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Signing in brings the account's saved basket and items in, merged with whatever the guest had.
  useEffect(() => {
    setSynced(false)
    if (!userId) {
      // Signing out on a shared device must not leave the last customer's basket behind.
      if (wasSignedIn.current) { dispatch({ type: 'clear' }); setSaved([]) }
      wasSignedIn.current = false
      return undefined
    }
    wasSignedIn.current = true
    let cancelled = false
    fetchProfile(tokenRef.current).then((profile) => {
      if (cancelled) return
      const remote = profile.cart && typeof profile.cart === 'object' ? profile.cart : {}
      dispatch({ type: 'merge', cart: remote })
      const remoteSaved = Array.isArray(profile.saved) ? profile.saved : []
      setSaved((current) => [...new Set([...remoteSaved, ...current])])
      setSynced(true)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [userId])

  // Keep the account copy current (debounced) once the first merge has happened.
  useEffect(() => {
    if (!userId || !synced) return undefined
    const handle = window.setTimeout(() => {
      saveProfile(tokenRef.current, { cart, saved: savedIds }).catch(() => {})
    }, 800)
    return () => window.clearTimeout(handle)
  }, [userId, synced, cart, savedIds])

  // Once stock is known, bring persisted quantities down to it. Out-of-stock lines
  // stay in storage (the drawer flags them) and are only blocked from the order.
  useEffect(() => {
    if (status === 'loading') return
    const stockById = new Map(products.map((product) => [product.id, Number(product.stock)]))
    for (const [id, quantity] of Object.entries(cart)) {
      const stock = stockById.get(id)
      if (Number.isFinite(stock) && stock >= 1 && quantity > stock) {
        dispatch({ type: 'set', id, quantity, max: Math.floor(stock) })
      }
    }
  }, [cart, products, status])

  const value = useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]))
    // Keep raw ids in storage until the catalogue has loaded, then hide orphans.
    const saved = status === 'loading' ? savedIds : savedIds.filter((id) => byId.has(id))
    const limitFor = (id) => {
      const product = byId.get(id)
      const stock = Number(product?.stock)
      return product && Number.isFinite(stock) ? Math.max(0, Math.min(MAX_QUANTITY, Math.floor(stock))) : MAX_QUANTITY
    }
    const lines = cartLines(cart, products)
    const notify = (message) => {
      setNotice(message)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setNotice(''), 3000)
    }
    return {
      cart,
      lines,
      totals: cartTotals(lines),
      saved,
      cartOpen,
      orderOpen,
      notice,
      notify,
      add: (id, quantity = 1) => {
        const max = limitFor(id)
        if (max < 1) { notify('This product is out of stock'); return }
        if ((cart[id] || 0) >= max) { notify('All available stock is in your basket'); return }
        dispatch({ type: 'add', id, quantity, max })
        notify('Added to your basket')
      },
      setQty: (id, quantity) => dispatch({ type: 'set', id, quantity, max: limitFor(id) }),
      remove: (id) => dispatch({ type: 'remove', id }),
      clearCart: () => dispatch({ type: 'clear' }),
      isSaved: (id) => saved.includes(id),
      toggleSaved: (id) => {
        setSaved((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
        notify(savedIds.includes(id) ? 'Removed from saved items' : 'Saved for later')
      },
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      openOrder: () => { setCartOpen(false); setOrderOpen(true) },
      closeOrder: () => setOrderOpen(false),
    }
  }, [cart, products, status, savedIds, cartOpen, orderOpen, notice])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside StoreProvider')
  return value
}
