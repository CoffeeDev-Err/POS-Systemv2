export default function ProductModal({
  open,
  editProduct,
  form,
  onFormChange,
  categories,
  newCatMode,
  newCatInput,
  onNewCatMode,
  onNewCatInput,
  onAddCategory,
  onClose,
  onSave,
  saving,
  error,
}) {
  if (!open) return null;

  return (
    <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className={`bi ${editProduct ? 'bi-pencil-square' : 'bi-plus-circle'} me-2`}></i>
              {editProduct ? 'Edit Product' : 'Add New Product'}
            </h5>
            <button className="btn-close" onClick={onClose}></button>
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
                <input
                  className="form-control"
                  value={form.name}
                  onChange={e => onFormChange({ ...form, name: e.target.value })}
                  placeholder="e.g. Itlog (per piraso)"
                />
              </div>

              <div className="col-12">
                <label className="form-label fw-semibold">Category *</label>
                {!newCatMode ? (
                  <div className="d-flex gap-2">
                    <select
                      className="form-select"
                      value={form.category}
                      onChange={e => onFormChange({ ...form, category: e.target.value })}
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm flex-shrink-0"
                      onClick={() => onNewCatMode(true)}
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
                      onChange={e => onNewCatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && onAddCategory()}
                    />
                    <button type="button" className="btn btn-success btn-sm flex-shrink-0" onClick={onAddCategory}>
                      <i className="bi bi-check2"></i>
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm flex-shrink-0" onClick={() => { onNewCatMode(false); onNewCatInput(''); }}>
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
                <select
                  className="form-select"
                  value={form.unit}
                  onChange={e => onFormChange({ ...form, unit: e.target.value })}
                >
                  {['pc', 'tray', 'btl', 'pack', 'kg', 'sachet', 'liter', 'box'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label fw-semibold">Price (₱) *</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.price}
                  onChange={e => onFormChange({ ...form, price: e.target.value })}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="col-6">
                <label className="form-label fw-semibold">Cost (₱) *</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.cost}
                  onChange={e => onFormChange({ ...form, cost: e.target.value })}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div className="col-6">
                <label className="form-label fw-semibold">Current Stock *</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.stock}
                  onChange={e => onFormChange({ ...form, stock: e.target.value })}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="col-6">
                <label className="form-label fw-semibold">Low Stock Alert</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.lowStockAlert}
                  onChange={e => onFormChange({ ...form, lowStockAlert: e.target.value })}
                  placeholder="10"
                  min="0"
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-dark"
              onClick={onSave}
              disabled={saving || !form.name || !form.price || !form.cost || !form.stock || !form.category}
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
  );
}
