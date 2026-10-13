import Header from './Header.jsx'
import Footer from './Footer.jsx'
import Toast from './Toast.jsx'
import WhatsAppButton from './WhatsAppButton.jsx'
import CartDrawer from './CartDrawer.jsx'
import OrderModal from './OrderModal.jsx'
import { useCatalog } from '../context/CatalogContext.jsx'

export default function Layout({ children }) {
  const { status } = useCatalog()
  return (
    <>
      <Header />
      {status === 'sample' && (
        <div className="container" style={{ paddingTop: 12 }}>
          <p className="notice">Showing our sample catalogue. Live stock is not available right now.</p>
        </div>
      )}
      <main>{children}</main>
      <Footer />
      <CartDrawer />
      <OrderModal />
      <WhatsAppButton />
      <Toast />
    </>
  )
}
