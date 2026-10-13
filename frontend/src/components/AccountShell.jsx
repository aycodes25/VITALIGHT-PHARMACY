import { Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useStore } from '../context/StoreContext.jsx'

// Wraps signed-in pages: redirects guests to sign in and renders the account side menu.
export default function AccountShell({ title, children }) {
  const { loading, user, signOut } = useAuth()
  const { saved } = useStore()
  const location = useLocation()
  const navigate = useNavigate()

  if (loading) return <section className="container section"><p>Loading your account…</p></section>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  const name = user.user_metadata?.full_name || user.email

  return (
    <section className="container section">
      <p className="eyebrow">Hello, {name}</p>
      <h1 className="page-title">{title}</h1>
      <div className="account-grid">
        <nav className="account-menu" aria-label="Account">
          <NavLink to="/account" end>My details</NavLink>
          <NavLink to="/account/orders">Order history</NavLink>
          <NavLink to="/saved">Saved items{saved.length > 0 ? ` (${saved.length})` : ''}</NavLink>
          <button type="button" onClick={async () => { await signOut(); navigate('/', { replace: true }) }}>Sign out</button>
        </nav>
        <div className="account-body">{children}</div>
      </div>
    </section>
  )
}
