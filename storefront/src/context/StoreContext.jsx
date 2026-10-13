import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { cartLines, cartReducer, cartTotals } from '../../../shared/cart.js'
import { useCatalog } from './CatalogContext.jsx'

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

export function StoreProvider({ children }) {
  const { products } = useCatalog()
  const [cart, dispatch] = useReducer(cartReducer, undefined, () => load(CART_KEY, {}, isPlainObject))
  const [saved, setSaved] = useState(() => load(SAVED_KEY, [], Array.isArray))
  const [cartOpen, setCartOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const timer = useRef(null)

  useEffect(() => save(CART_KEY, cart), [cart])
  useEffect(() => save(SAVED_KEY, saved), [saved])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const value = useMemo(() => {
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
      add: (id, quantity = 1) => { dispatch({ type: 'add', id, quantity }); notify('Added to your basket') },
      setQty: (id, quantity) => dispatch({ type: 'set', id, quantity }),
      remove: (id) => dispatch({ type: 'remove', id }),
      clearCart: () => dispatch({ type: 'clear' }),
      isSaved: (id) => saved.includes(id),
      toggleSaved: (id) => {
        setSaved((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
        notify(saved.includes(id) ? 'Removed from saved items' : 'Saved for later')
      },
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      openOrder: () => { setCartOpen(false); setOrderOpen(true) },
      closeOrder: () => setOrderOpen(false),
    }
  }, [cart, products, saved, cartOpen, orderOpen, notice])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside StoreProvider')
  return value
}
