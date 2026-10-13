export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null
  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="btn btn-outline" type="button" disabled={page <= 1} aria-label="Previous page" onClick={() => onChange(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button className="btn btn-outline" type="button" disabled={page >= pages} aria-label="Next page" onClick={() => onChange(page + 1)}>Next</button>
    </nav>
  )
}
