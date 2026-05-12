import { useState } from 'react';
import {
  ProductsToolbar,
  CategoryCards,
  ProductsTable,
  ProductModal,
  DeleteConfirmModal,
} from './products/index';

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
    if (!form.name || !form.price || !form.cost || !form.stock || !form.category) return;

    setSaving(true);
    setError('');

    const payload = {
      ...form,
      price: parseFloat(form.price),
      cost: parseFloat(form.cost),
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
    const confirmMessage = inUse
      ? `Delete "${cat}" and its products? This will remove ${products.filter(p => p.category === cat).length} product(s) and cannot be undone.`
      : `Delete "${cat}" category? This cannot be undone.`;

    if (!window.confirm(confirmMessage)) return;

    setSaving(true);
    setError('');
    try {
      await onDeleteCategory(cat, { deleteProducts: inUse });
      if (catFilter === cat) setCatFilter('All');
    } catch (err) {
      setError(err.message || 'Failed to delete category.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <ProductsToolbar
        search={search}
        onSearchChange={setSearch}
        catFilter={catFilter}
        categories={categories}
        onCategoryChange={setCatFilter}
        onAddProduct={openAdd}
      />

      <CategoryCards
        categories={categories}
        products={products}
        catFilter={catFilter}
        onSelectCategory={setCatFilter}
        onDeleteCategory={handleDeleteCategory}
      />

      <ProductsTable
        products={filtered}
        onEdit={openEdit}
        onDelete={setDeleteId}
      />

      <ProductModal
        open={showModal}
        editProduct={editProduct}
        form={form}
        onFormChange={setForm}
        categories={categories}
        newCatMode={newCatMode}
        newCatInput={newCatInput}
        onNewCatMode={setNewCatMode}
        onNewCatInput={setNewCatInput}
        onAddCategory={handleAddCategory}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        saving={saving}
        error={error}
      />

      <DeleteConfirmModal
        open={Boolean(deleteId)}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        saving={saving}
      />
    </div>
  );
}
