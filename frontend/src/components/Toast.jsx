import { useStore } from '../context/StoreContext.jsx'

export default function Toast() {
  const { notice } = useStore()
  if (!notice) return null
  return <div className="toast" role="status">{notice}</div>
}
