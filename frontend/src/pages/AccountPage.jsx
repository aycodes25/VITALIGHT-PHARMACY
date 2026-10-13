import { useEffect, useState } from 'react'
import { fetchProfile, saveProfile } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import AccountShell from '../components/AccountShell.jsx'

export default function AccountPage() {
  const { user, session } = useAuth()
  const token = session?.access_token
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [state, setState] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    fetchProfile(token).then((profile) => {
      if (cancelled) return
      setForm({
        name: profile.name || user?.user_metadata?.full_name || '',
        phone: profile.phone || '',
        address: profile.address || '',
      })
      setState('ready')
    }).catch((error) => {
      if (cancelled) return
      setMessage(error.message)
      setState('error')
    })
    return () => { cancelled = true }
  }, [token, user])

  async function onSubmit(event) {
    event.preventDefault()
    setState('saving')
    setMessage('')
    try {
      await saveProfile(token, form)
      setMessage('Your details were saved. We will prefill them at checkout.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setState('ready')
    }
  }

  return (
    <AccountShell title="My account">
      <div className="account-card">
        <h2>My details</h2>
        {state === 'loading' && <p style={{ marginTop: 12 }}>Loading your details…</p>}
        {state === 'error' && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{message}</p>}
        {(state === 'ready' || state === 'saving') && (
          <form className="form" onSubmit={onSubmit}>
            <label>Email<input value={user?.email ?? ''} readOnly disabled /></label>
            <label>Full name<input autoComplete="name" minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>Phone number<input autoComplete="tel" type="tel" pattern="[+0-9\(\)\- ]{7,25}" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+234 800 000 0000" /></label>
            <label>Delivery address<textarea autoComplete="street-address" maxLength={500} rows={3} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Where should we deliver?" /></label>
            {message && <p className="notice" role="status">{message}</p>}
            <button className="btn btn-primary" type="submit" disabled={state === 'saving'}>{state === 'saving' ? 'Saving…' : 'Save details'}</button>
          </form>
        )}
      </div>
    </AccountShell>
  )
}
