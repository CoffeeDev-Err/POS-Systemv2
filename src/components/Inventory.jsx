import { useState } from 'react';

export default function Inventory({ products, categories, stockMovements, onStockIn }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showStockIn, setShowStockIn] = useState(false);
  const [stockInForm, setStockInForm] = useState({ productId: '', qty: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const lowStock = products.filter(p => p.stock <= p.lowStockAlert);
  const outOfStock = products.filter(p => p.stock === 0);

  const filtered = products.filter(p => {
    const cat = catFilter === 'All' || p.category === catFilter;
    const s = p.name.toLowerCase().includes(search.toLowerCase());
    return cat && s;
  });

  const handleStockIn = async () => {
    const product = products.find(p => p.id === parseInt(stockInForm.productId));
    if (!product || !stockInForm.qty) return;

    setSaving(true);
    setError('');

    try {
      await onStockIn({
        productId: product.id,
        qty: parseInt(stockInForm.qty),
        note: stockInForm.note || 'Manual stock-in',
      });
      setStockInForm({ productId: '', qty: '', note: '' });
      setShowStockIn(false);
    } catch (err) {
      setError(err.message || 'Failed to stock in.');
    } finally {
      setSaving(false);
    }
  };

  const getStockStatus = (p) => {
    if (p.stock === 0) return { color: 'danger', label: 'Out of Stock' };
    if (p.stock <= p.lowStockAlert) return { color: 'warning', label: 'Low Stock' };
    return { color: 'success', label: 'In Stock' };
  };

  return (
    <div>
      {/* Alert banners */}
      {outOfStock.length > 0 && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
          <i className="bi bi-exclamation-circle-fill flex-shrink-0"></i>
          <div><strong>{outOfStock.length} product{outOfStock.length > 1 ? 's' : ''} out of stock:</strong> {outOfStock.map(p => p.name).join(', ')}</div>
        </div>
      )}
      {lowStock.length > 0 && (
        <div className="alert alert-warning d-flex align-items-center gap-2 mb-3">
          <i className="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
          <div><strong>{lowStock.length} product{lowStock.length > 1 ? 's' : ''} running low:</strong> {lowStock.map(p => `${p.name} (${p.stock} left)`).join(', ')}</div>
        </div>
      )}

      {/* Toolbar */}
      <div className="d-flex flex-wrap gap-2 mb-4 align-items-center justify-content-between">
        <div className="d-flex gap-2 flex-wrap flex-grow-1">
          <div className="input-group" style={{ maxWidth: 260 }}>
            <span className="input-group-text bg-light"><i className="bi bi-search text-muted"></i></span>
            <input className="form-control" placeholder="Search product..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ maxWidth: 160 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn btn-dark" onClick={() => setShowStockIn(true)}>
          <i className="bi bi-plus-circle me-2"></i>Stock In
        </button>
      </div>

      <div className="row g-3">
        {/* Inventory Table */}
        <div className="col-lg-8">
          <div className="card card-custom">
            <div className="card-header-custom">
              <i className="bi bi-clipboard2-data me-2"></i>Stock Levels ({filtered.length})
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="text-center">Stock</th>
                    <th className="text-center">Alert At</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const status = getStockStatus(p);
                    const pct = Math.min(100, (p.stock / (p.lowStockAlert * 3)) * 100);
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="fw-semibold">{p.name}</span>
                          <div className="small text-muted">{p.unit}</div>
                        </td>
                        <td><span className="badge bg-light text-dark border small">{p.category}</span></td>
                        <td className="text-center">
                          <div className="fw-bold">{p.stock}</div>
                          <div className="progress mt-1" style={{ height: 4, width: 60, margin: 'auto' }}>
                            <div
                              className={`progress-bar bg-${status.color}`}
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="text-center text-muted small">{p.lowStockAlert}</td>
                        <td className="text-center">
                          <span className={`badge bg-${status.color}${status.color === 'warning' ? ' text-dark' : ''}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="text-center">
                          <button className="btn btn-outline-secondary btn-sm" onClick={() => {
                            setStockInForm({ productId: String(p.id), qty: '', note: '' });
                            setShowStockIn(true);
                          }}>
                            <i className="bi bi-plus-lg me-1"></i>Add
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Stock History */}
        <div className="col-lg-4">
          <div className="card card-custom">
            <div className="card-header-custom">
              <i className="bi bi-clock-history me-2"></i>Recent Stock Activity
            </div>
            <div className="card-body p-0">
              <ul className="list-group list-group-flush">
                {(stockMovements || []).slice().reverse().map(h => (
                  <li key={h.id} className="list-group-item py-2">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="small fw-semibold">{h.product}</div>
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>{h.note || 'Stock movement'} • {h.date} {h.time}</div>
                      </div>
                      <span className={`badge ${h.type === 'stock-in' ? 'bg-success' : h.type === 'sale' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                        {h.type === 'stock-in' ? '+' : '-'}{h.qty}
                      </span>
                    </div>
                  </li>
                ))}
                {(!stockMovements || stockMovements.length === 0) && (
                  <li className="list-group-item text-center text-muted py-3 small">No stock activity yet</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Stock In Modal */}
      {showStockIn && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-plus-circle me-2"></i>Stock In — Add Delivery</h5>
                <button className="btn-close" onClick={() => setShowStockIn(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger py-2 small">
                    <i className="bi bi-exclamation-circle me-1"></i>{error}
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Select Product *</label>
                  <select className="form-select" value={stockInForm.productId} onChange={e => setStockInForm({ ...stockInForm, productId: e.target.value })}>
                    <option value="">-- Choose product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Current: {p.stock} {p.unit})</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Quantity to Add *</label>
                  <input type="number" className="form-control" value={stockInForm.qty} onChange={e => setStockInForm({ ...stockInForm, qty: e.target.value })} placeholder="Enter quantity" min="1" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Note / Source</label>
                  <input className="form-control" value={stockInForm.note} onChange={e => setStockInForm({ ...stockInForm, note: e.target.value })} placeholder="e.g. Supplier delivery, manual adjustment..." />
                </div>

                {stockInForm.productId && stockInForm.qty && (
                  <div className="alert alert-info py-2 small">
                    <i className="bi bi-info-circle me-1"></i>
                    New stock will be: <strong>
                      {(products.find(p => p.id === parseInt(stockInForm.productId))?.stock || 0) + parseInt(stockInForm.qty || 0)}
                    </strong> units
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setShowStockIn(false)}>Cancel</button>
                <button className="btn btn-dark" onClick={handleStockIn} disabled={saving || !stockInForm.productId || !stockInForm.qty}>
                  {saving
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                    : <><i className="bi bi-check2 me-2"></i>Confirm Stock In</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
