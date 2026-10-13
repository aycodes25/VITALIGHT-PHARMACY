export const MAX_QUANTITY = 99

export function cartReducer(state, action) {
  switch (action.type) {
    case 'add': {
      const next = Math.min(MAX_QUANTITY, (state[action.id] || 0) + (action.quantity ?? 1))
      return { ...state, [action.id]: next }
    }
    case 'set': {
      const quantity = Math.min(MAX_QUANTITY, Math.floor(action.quantity))
      if (!(quantity >= 1)) {
        const { [action.id]: _removed, ...rest } = state
        return rest
      }
      return { ...state, [action.id]: quantity }
    }
    case 'remove': {
      const { [action.id]: _removed, ...rest } = state
      return rest
    }
    case 'clear':
      return {}
    default:
      return state
  }
}

export function cartLines(cart, products) {
  return products
    .filter((product) => cart[product.id] > 0)
    .map((product) => ({
      product,
      quantity: cart[product.id],
      lineTotal: product.price * cart[product.id],
    }))
}

export function cartTotals(lines) {
  return {
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    total: lines.reduce((sum, line) => sum + line.lineTotal, 0),
    hasRx: lines.some((line) => Boolean(line.product.rx_required)),
  }
}
