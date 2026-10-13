import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { CatalogProvider } from './context/CatalogContext.jsx'
import { StoreProvider } from './context/StoreContext.jsx'
import Layout from './components/Layout.jsx'
import HomePage from './pages/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <CatalogProvider>
        <StoreProvider>
          <ScrollToTop />
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Layout>
        </StoreProvider>
      </CatalogProvider>
    </BrowserRouter>
  )
}
