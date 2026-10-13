import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { CatalogProvider } from './context/CatalogContext.jsx'
import { StoreProvider } from './context/StoreContext.jsx'
import Layout from './components/Layout.jsx'
import HomePage from './pages/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import CategoryPage from './pages/CategoryPage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import SavedPage from './pages/SavedPage.jsx'

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
              <Route path="/category/:slug" element={<CategoryPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/saved" element={<SavedPage />} />
              <Route path="*"element={<NotFoundPage />} />
            </Routes>
          </Layout>
        </StoreProvider>
      </CatalogProvider>
    </BrowserRouter>
  )
}
