import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="container section" style={{ textAlign: 'center' }}>
      <p className="eyebrow">404</p>
      <h1 style={{ margin: '12px 0' }}>We couldn’t find that page</h1>
      <p style={{ marginBottom: 24 }}>The product or category may have moved.</p>
      <Link className="btn btn-primary" to="/">Back to the shop</Link>
    </section>
  )
}
