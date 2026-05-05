import { useState } from 'react';

const EMPTY = { name: '', category: '', price: '', cost: '', unit: 'pc', stock: '', lowStockAlert: '' };

export default function Products({
  products,
  categories,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  onCreateCategory,
  onDeleteCategory,
}) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({ ...EMPTY, category: categories[0] || '' });
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // New-category creation inside the form
  const [newCatMode, setNewCatMode] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');

  // Derived emoji per category (simple palette)
  const CAT_EMOJIS = { Eggs: '🥚', Mantika: '🫙', 'Daily Needs': '🛍️' };
  const FALLBACK_EMOJIS = ['📦', '🏪', '🧴', '🥫', '🧃', '🍬'];
  const getCatEmoji = (cat) => CAT_EMOJIS[cat] || FALLBACK_EMOJIS[categories.indexOf(cat) % FALLBACK_EMOJIS.length] || '📦';

  const filtered = products.filter(p => {
    const cat = catFilter === 'All' || p.category === catFilter;
    const s = p.name.toLowerCase().includes(search.toLowerCase());
    return cat && s;
  });

  const openAdd = () => {
    setForm({ ...EMPTY, category: categories[0] || '' });
    setEditProduct(null);
    setNewCatMode(false);
    setNewCatInput('');
    setError('');
    setShowModal(true);
  };

  const openEdit = (p) => {
    setForm({
      ...p,
      price: String(p.price),
      cost: String(p.cost ?? ''),
      stock: String(p.stock),
      lowStockAlert: String(p.lowStockAlert),
    });
    setEditProduct(p);
    setNewCatMode(false);
    setNewCatInput('');
    setError('');
    setShowModal(true);
  };

  const handleAddCategory = async () => {
    const trimmed = newCatInput.trim();
    if (!trimmed || categories.includes(trimmed)) return;

    setSaving(true);
    setError('');
    try {
      await onCreateCategory(trimmed);
      setForm(f => ({ ...f, category: trimmed }));
      setNewCatMode(false);
      setNewCatInput('');
    } catch (err) {
      setError(err.message || 'Failed to add category.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.price || !form.stock || !form.category) return;

    setSaving(true);
    setError('');

    const payload = {
      ...form,
      price: parseFloat(form.price),
      cost: parseFloat(form.cost) || 0,
      stock: parseInt(form.stock),
      lowStockAlert: parseInt(form.lowStockAlert) || 0,
    };

    try {
      if (editProduct) {
        await onUpdateProduct(editProduct.id, payload);
      } else {
        await onCreateProduct(payload);
      }
      setShowModal(false);
    } catch (err) {
      setError(err.message || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError('');
    try {
      await onDeleteProduct(deleteId);
      setDeleteId(null);
    } catch (err) {
      setError(err.message || 'Failed to delete product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    const inUse = products.some(p => p.category === cat);
    if (inUse) {
      alert(`Cannot delete "${cat}" — it still has products assigned to it. Reassign those products first.`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onDeleteCategory(cat);
      if (catFilter === cat) setCatFilter('All');
    } catch (err) {
      setError(err.message || 'Failed to delete category.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="d-flex flex-wrap gap-2 mb-4 align-items-center justify-content-between">
        <div className="d-flex gap-2 flex-wrap flex-grow-1">
          <div className="input-group" style={{ maxWidth: 280 }}>
            <span className="input-group-text bg-light"><i className="bi bi-search text-muted"></i></span>
            <input className="form-control" placeholder="Search product..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ maxWidth: 180 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn btn-dark" onClick={openAdd}>
          <i className="bi bi-plus-circle me-2"></i>Add Product
        </button>
      </div>

      {/* Category Cards (dynamic) */}
      <div className="row g-2 mb-4">
        {['All', ...categories].map(cat => {
          const count = cat === 'All' ? products.length : products.filter(p => p.category === cat).length;
          return (
            <div className="col-6 col-md-3" key={cat}>
              <div
                className={`card text-center py-2 ${catFilter === cat ? 'border-dark border-2' : 'border'}`}
                onClick={() => setCatFilter(cat)}
                style={{ cursor: 'pointer' }}
              >
                <div className="fs-4">{cat === 'All' ? '📦' : getCatEmoji(cat)}</div>
                <div className="fw-bold">{count}</div>
                <div className="text-muted small d-flex align-items-center justify-content-center gap-1">
                  {cat}
                  {cat !== 'All' && (
                    <button
                      className="btn btn-link p-0 text-danger"
                      style={{ fontSize: '0.65rem', lineHeight: 1 }}
                      title={`Delete "${cat}" category`}
                      onClick={e => { e.stopPropagation(); handleDeleteCategory(cat); }}
                    >
                      <i className="bi bi-x-circle-fill"></i>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {/* Add new category card */}
        <div className="col-6 col-md-3">
          <div
            className="card text-center py-2 border-dashed h-100 d-flex align-items-center justify-content-center"
            style={{ cursor: 'pointer', border: '2px dashed #dee2e6', minHeight: 80 }}
            onClick={openAdd}
            title="Add a new product (you can create categories from the product form)"
          >
            <div className="fs-4 text-muted">+</div>
            <div className="text-muted small">New Product</div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card card-custom">
        <div className="card-header-custom">
          <i className="bi bi-box-seam me-2"></i>Products ({filtered.length})
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
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <span className="me-2">{getCatEmoji(p.category)}</span>
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
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => openEdit(p)} title="Edit">
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => setDeleteId(p.id)} title="Delete">
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="8" className="text-center text-muted py-4">No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className={`bi ${editProduct ? 'bi-pencil-square' : 'bi-plus-circle'} me-2`}></i>
                  {editProduct ? 'Edit Product' : 'Add New Product'}
                </h5>
                <button className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger py-2 small">
                    <i className="bi bi-exclamation-circle me-1"></i>{error}
                  </div>
                )}
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">Product Name *</label>
                    <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Itlog (per piraso)" />
                  </div>

                  {/* Dynamic Category select */}
                  <div className="col-12">
                    <label className="form-label fw-semibold">Category *</label>
                    {!newCatMode ? (
                      <div className="d-flex gap-2">
                        <select
                          className="form-select"
                          value={form.category}
                          onChange={e => setForm({ ...form, category: e.target.value })}
                        >
                          {categories.map(c => <option key={c} value={c}>{getCatEmoji(c)} {c}</option>)}
                        </select>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm flex-shrink-0"
                          onClick={() => setNewCatMode(true)}
                          title="Create a new category"
                        >
                          <i className="bi bi-plus-lg me-1"></i>New
                        </button>
                      </div>
                    ) : (
                      <div className="d-flex gap-2">
                        <input
                          autoFocus
                          className="form-control"
                          placeholder="New category name..."
                          value={newCatInput}
                          onChange={e => setNewCatInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                        />
                        <button type="button" className="btn btn-success btn-sm flex-shrink-0" onClick={handleAddCategory}>
                          <i className="bi bi-check2"></i>
                        </button>
                        <button type="button" className="btn btn-outline-secondary btn-sm flex-shrink-0" onClick={() => { setNewCatMode(false); setNewCatInput(''); }}>
                          <i className="bi bi-x"></i>
                        </button>
                      </div>
                    )}
                    {categories.length === 0 && !newCatMode && (
                      <div className="text-muted small mt-1">No categories yet — click "+ New" to create one.</div>
                    )}
                  </div>

                  <div className="col-6">
                    <label className="form-label fw-semibold">Unit *</label>
                    <select className="form-select" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                      {['pc', 'tray', 'btl', 'pack', 'kg', 'sachet', 'liter', 'box'].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Price (₱) *</label>
                    <input type="number" className="form-control" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" min="0" step="0.01" />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Cost (₱)</label>
                    <input type="number" className="form-control" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="0.00" min="0" step="0.01" />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Current Stock *</label>
                    <input type="number" className="form-control" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="0" min="0" />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Low Stock Alert</label>
                    <input type="number" className="form-control" value={form.lowStockAlert} onChange={e => setForm({ ...form, lowStockAlert: e.target.value })} placeholder="10" min="0" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button
                  className="btn btn-dark"
                  onClick={handleSave}
                  disabled={saving || !form.name || !form.price || !form.stock || !form.category}
                >
                  {saving
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                    : <><i className="bi bi-check2 me-2"></i>Save Product</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-body text-center py-4">
                <i className="bi bi-exclamation-triangle-fill text-danger fs-1 d-block mb-3"></i>
                <h5>Delete Product?</h5>
                <p className="text-muted small mb-0">This action cannot be undone.</p>
              </div>
              <div className="modal-footer justify-content-center gap-2">
                <button className="btn btn-outline-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                  {saving
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Deleting...</>
                    : <><i className="bi bi-trash me-2"></i>Delete</>
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
