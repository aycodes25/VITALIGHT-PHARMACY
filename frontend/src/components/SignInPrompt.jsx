import { Link, useLocation } from 'react-router-dom'
import Icon from './Icon.jsx'

// Shown instead of the order form: an account is required before an order request can be sent.
export default function SignInPrompt({ onClose }) {
  const location = useLocation()
  const state = { from: location.pathname }
  return (
    <div className="overlay center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="signin-title">
        <div className="row">
          <h2 id="signin-title">Sign in to request your order</h2>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </div>
        <p style={{ marginTop: 8 }}>Your basket is saved. Sign in or create a free account so we can track your order and keep your history.</p>
        <Link className="btn btn-primary btn-block" style={{ marginTop: 16 }} to="/login" state={state} onClick={onClose}>Sign in</Link>
        <Link className="btn btn-outline btn-block" style={{ marginTop: 10 }} to="/signup" state={state} onClick={onClose}>Create an account</Link>
      </section>
    </div>
  )
}
