import React, { Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/pages.css'

const Admin = lazy(() => import('./admin/Admin.jsx'))
const isAdmin = window.location.pathname.startsWith('/admin')

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? <Suspense fallback={null}><Admin /></Suspense> : <App />}
  </React.StrictMode>,
)
