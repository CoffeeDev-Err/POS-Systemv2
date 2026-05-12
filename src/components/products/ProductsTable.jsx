export default function ProductsTable({ products, onEdit, onDelete }) {
  return (
    <div className=" card-custom">
      <div className="card-header-custom">
        <i className="bi bi-box-seam me-2"></i>Products ({products.length})
      </div>
      <div className="table-responsive">
        <table className="table table-hover mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th className="text-end">Price</th>
              <th className="text-end">Cost</th>
              <th className="text-center">Unit</th>
              <th className="text-center">Stock</th>
              <th className="text-center">Alert</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td>
                  <span className="fw-semibold">{p.name}</span>
                </td>
                <td><span className="badge bg-light text-dark border">{p.category}</span></td>
                <td className="text-end">₱{p.price.toFixed(2)}</td>
                <td className="text-end text-muted">₱{Number(p.cost || 0).toFixed(2)}</td>
                <td className="text-center text-muted small">{p.unit}</td>
                <td className="text-center">
                  <span className={`badge ${p.stock === 0 ? 'bg-danger' : p.stock <= p.lowStockAlert ? 'bg-warning text-dark' : 'bg-success'}`}>
                    {p.stock}
                  </span>
                </td>
                <td className="text-center text-muted small">{p.lowStockAlert}</td>
                <td className="text-center">
                  <div className="d-flex gap-1 justify-content-center">
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => onEdit(p)} title="Edit">
                      <i className="bi bi-pencil me-1"></i>Edit
                    </button>
                    <button className="btn btn-outline-danger btn-sm" onClick={() => onDelete(p.id)} title="Remove">
                      <i className="bi bi-trash me-1"></i>Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan="8" className="text-center text-muted py-4">No products found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
