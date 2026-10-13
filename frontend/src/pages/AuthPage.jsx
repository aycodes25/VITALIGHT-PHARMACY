import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function friendly(error) {
  const message = error?.message || ''
  if (/invalid login credentials/i.test(message)) return 'That email and password do not match. Check them or reset your password.'
  if (/email not confirmed/i.test(message)) return 'Confirm your email first. We sent you a link when you signed up.'
  if (/already registered|already been registered/i.test(message)) return 'An account with this email already exists. Sign in instead.'
  if (/password should be at least/i.test(message)) return 'Choose a password of at least 8 characters.'
  return message || 'Something went wrong. Please try again.'
}

export default function AuthPage({ mode }) {
  const isSignup = mode === 'signup'
  const { configured, loading, user, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destination = location.state?.from || '/account'
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmSent, setConfirmSent] = useState(false)

  if (!loading && user) return <Navigate to={destination} replace />

  async function onSubmit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (isSignup) {
        const result = await signUp({ email: form.email.trim(), password: form.password, name: form.name.trim() })
        if (result.needsConfirmation) setConfirmSent(true)
        else navigate(destination, { replace: true })
      } else {
        await signIn(form.email.trim(), form.password)
        navigate(destination, { replace: true })
      }
    } catch (submitError) {
      setError(friendly(submitError))
    } finally {
      setBusy(false)
    }
  }

  if (confirmSent) {
    return (
      <section className="container section auth-wrap">
        <div className="auth-card">
          <h1 className="page-title">Check your email</h1>
          <p style={{ marginTop: 12 }}>We sent a confirmation link to <strong>{form.email}</strong>. Open it to activate your account, then sign in.</p>
          <Link className="btn btn-primary btn-block" style={{ marginTop: 20 }} to="/login">Go to sign in</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="container section auth-wrap">
      <div className="auth-card">
        <p className="eyebrow">{isSignup ? 'Join Vitalight' : 'Welcome back'}</p>
        <h1 className="page-title">{isSignup ? 'Create your account' : 'Sign in'}</h1>
        {!configured && <p className="notice" style={{ marginTop: 12 }}>Accounts are not available right now. You can still shop and send an order request as a guest.</p>}
        <form className="form" onSubmit={onSubmit}>
          {isSignup && (
            <label>Full name<input autoComplete="name" required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Ayomide Tominiyi" /></label>
          )}
          <label>Email<input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label>
          <label>Password<input type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} required minLength={isSignup ? 8 : 1} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={isSignup ? 'At least 8 characters' : 'Your password'} /></label>
          {!isSignup && <Link className="text-link" to="/forgot-password">Forgot your password?</Link>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !configured}>
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="auth-switch">
          {isSignup
            ? <>Already have an account? <Link className="text-link" to="/login" state={location.state}>Sign in</Link></>
            : <>New to Vitalight? <Link className="text-link" to="/signup" state={location.state}>Create an account</Link></>}
        </p>
      </div>
    </section>
  )
}
