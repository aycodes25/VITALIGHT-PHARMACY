import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ResetPasswordPage() {
  const { loading, user, recovering, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    if (busy) return
    if (password !== confirm) { setError('The two passwords do not match.'); return }
    setBusy(true)
    setError('')
    try {
      await updatePassword(password)
      setDone(true)
      window.setTimeout(() => navigate('/account', { replace: true }), 1500)
    } catch (updateError) {
      setError(updateError.message || 'We could not update your password. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // A valid recovery link signs the customer in; without one there is nothing to reset.
  const canReset = recovering || Boolean(user)
  return (
    <section className="container section auth-wrap">
      <div className="auth-card">
        <p className="eyebrow">Account help</p>
        <h1 className="page-title">Choose a new password</h1>
        {done ? (
          <p className="notice" style={{ marginTop: 12 }}>Your password was updated. Taking you to your account…</p>
        ) : loading ? (
          <p style={{ marginTop: 12 }}>Checking your reset link…</p>
        ) : !canReset ? (
          <>
            <p style={{ marginTop: 12 }}>This reset link is invalid or has expired. Request a new one to continue.</p>
            <Link className="btn btn-primary btn-block" style={{ marginTop: 20 }} to="/forgot-password">Request a new link</Link>
          </>
        ) : (
          <form className="form" onSubmit={onSubmit}>
            <label>New password<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
            <label>Confirm new password<input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
          </form>
        )}
      </div>
    </section>
  )
}
