import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ForgotPasswordPage() {
  const { configured, sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await sendPasswordReset(email.trim())
      setSent(true)
    } catch (resetError) {
      setError(resetError.message || 'We could not send the reset email. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="container section auth-wrap">
      <div className="auth-card">
        <p className="eyebrow">Account help</p>
        <h1 className="page-title">Reset your password</h1>
        {sent ? (
          <>
            <p style={{ marginTop: 12 }}>If an account exists for <strong>{email}</strong>, a reset link is on its way. It can take a minute to arrive.</p>
            <Link className="btn btn-outline btn-block" style={{ marginTop: 20 }} to="/login">Back to sign in</Link>
          </>
        ) : (
          <form className="form" onSubmit={onSubmit}>
            <p>Enter the email you signed up with and we will send you a link to choose a new password.</p>
            <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy || !configured}>{busy ? 'Sending…' : 'Send reset link'}</button>
            <Link className="text-link" to="/login">Back to sign in</Link>
          </form>
        )}
      </div>
    </section>
  )
}
