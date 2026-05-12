import { useCallback, useEffect, useState } from 'react';
import {
  fetchProducts,
  fetchCategories,
  fetchTransactions,
  fetchUsers,
  fetchSettings,
  fetchAuditLogs,
  fetchStockMovements,
  fetchExpenses,
  createProduct,
  updateProduct,
  deleteProduct,
  createCategory,
  deleteCategory,
  createUser,
  updateUser,
  updateUserStatus,
  createTransaction,
  createStockMovement,
  createExpense,
  updateSettings,
} from '../utils/api';

const DEFAULT_SETTINGS = {
  storeName: "CARREN'S STORE",
  address: 'Urdaneta, Ilocos',
  phone: '09XX-XXX-XXXX',
  receiptFooter: 'Salamat sa inyong pagbili! Please come again :)',
};

/**
 * Centralized data store and actions for the POS app.
 * Keeps fetch logic in one place while preserving current API behavior.
 */
export function useAppData(currentUser) {
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const safeFetch = useCallback(async (fn, fallback) => {
    try {
      return await fn();
    } catch (err) {
      if (err && err.status === 403) return fallback;
      throw err;
    }
  }, []);

  const loadData = useCallback(async (role) => {
    const canManage = role === 'superadmin' || role === 'admin';
    const isSuper = role === 'superadmin';

    const results = await Promise.all([
      safeFetch(fetchProducts, []),
      safeFetch(fetchCategories, []),
      canManage ? safeFetch(fetchTransactions, []) : Promise.resolve([]),
      canManage ? safeFetch(fetchStockMovements, []) : Promise.resolve([]),
      canManage ? safeFetch(fetchExpenses, []) : Promise.resolve([]),
      isSuper ? safeFetch(fetchUsers, []) : Promise.resolve([]),
      isSuper ? safeFetch(fetchSettings, DEFAULT_SETTINGS) : Promise.resolve(DEFAULT_SETTINGS),
      isSuper ? safeFetch(fetchAuditLogs, []) : Promise.resolve([]),
    ]);

    setProducts(results[0]);
    setCategories(results[1]);
    setTransactions(results[2]);
    setStockMovements(results[3]);
    setExpenses(results[4]);
    setUsers(results[5]);
    setSettings(results[6] || DEFAULT_SETTINGS);
    setAuditLogs(results[7]);
  }, [safeFetch]);

  const resetData = useCallback(() => {
    setProducts([]);
    setTransactions([]);
    setUsers([]);
    setCategories([]);
    setStockMovements([]);
    setAuditLogs([]);
    setExpenses([]);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const refreshAuditLogs = useCallback(async () => {
    if (currentUser?.role !== 'superadmin') return;
    const logs = await fetchAuditLogs();
    setAuditLogs(logs);
  }, [currentUser]);

  const refreshStockMovements = useCallback(async () => {
    if (currentUser?.role !== 'superadmin' && currentUser?.role !== 'admin') return;
    const rows = await fetchStockMovements();
    setStockMovements(rows);
  }, [currentUser]);

  const mergeProducts = useCallback((updates) => {
    if (!Array.isArray(updates) || updates.length === 0) return;
    setProducts(prev => {
      const map = new Map(updates.map(p => [p.id, p]));
      return prev.map(p => map.get(p.id) || p);
    });
  }, []);

  const handleCreateProduct = useCallback(async (payload) => {
    const product = await createProduct(payload);
    setProducts(prev => [...prev, product]);
    setCategories(prev => (prev.includes(product.category) ? prev : [...prev, product.category]));
    await refreshAuditLogs();
    return product;
  }, [refreshAuditLogs]);

  const handleUpdateProduct = useCallback(async (id, payload) => {
    const product = await updateProduct(id, payload);
    setProducts(prev => prev.map(p => (p.id === product.id ? product : p)));
    setCategories(prev => (prev.includes(product.category) ? prev : [...prev, product.category]));
    await refreshAuditLogs();
    return product;
  }, [refreshAuditLogs]);

  const handleDeleteProduct = useCallback(async (id) => {
    await deleteProduct(id);
    setProducts(prev => prev.filter(p => p.id !== id));
    await refreshAuditLogs();
  }, [refreshAuditLogs]);

  const handleCreateCategory = useCallback(async (name) => {
    const res = await createCategory(name);
    setCategories(prev => (prev.includes(res.name) ? prev : [...prev, res.name]));
    await refreshAuditLogs();
    return res;
  }, [refreshAuditLogs]);

  const handleDeleteCategory = useCallback(async (name, options) => {
    await deleteCategory(name, options);
    setCategories(prev => prev.filter(c => c !== name));
    await refreshAuditLogs();
  }, [refreshAuditLogs]);

  const handleCreateUser = useCallback(async (payload) => {
    const user = await createUser(payload);
    setUsers(prev => [...prev, user]);
    await refreshAuditLogs();
    return user;
  }, [refreshAuditLogs]);

  const handleUpdateUser = useCallback(async (id, payload) => {
    const user = await updateUser(id, payload);
    setUsers(prev => prev.map(u => (u.id === user.id ? user : u)));
    await refreshAuditLogs();
    return user;
  }, [refreshAuditLogs]);

  const handleUpdateUserStatus = useCallback(async (id, payload) => {
    const user = await updateUserStatus(id, payload);
    setUsers(prev => prev.map(u => (u.id === user.id ? user : u)));
    await refreshAuditLogs();
    return user;
  }, [refreshAuditLogs]);

  const handleCreateTransaction = useCallback(async (payload) => {
    const res = await createTransaction(payload);
    setTransactions(prev => [...prev, res.transaction]);
    mergeProducts(res.updatedProducts);
    await refreshAuditLogs();
    await refreshStockMovements();
    return res.transaction;
  }, [mergeProducts, refreshAuditLogs, refreshStockMovements]);

  const handleStockIn = useCallback(async (payload) => {
    const res = await createStockMovement({ ...payload, type: 'stock-in' });
    setStockMovements(prev => [...prev, res.movement]);
    mergeProducts([res.product]);
    await refreshAuditLogs();
    return res;
  }, [mergeProducts, refreshAuditLogs]);

  const handleCreateExpense = useCallback(async (payload) => {
    const expense = await createExpense(payload);
    setExpenses(prev => [expense, ...prev]);
    return expense;
  }, []);

  const handleSaveSettings = useCallback(async (payload) => {
    const updated = await updateSettings(payload);
    setSettings(updated);
    return updated;
  }, []);

  useEffect(() => {
    if (!currentUser) return undefined;

    const canManage = currentUser.role === 'superadmin' || currentUser.role === 'admin';
    if (!canManage) return undefined;

    const poll = async () => {
      try {
        const [nextProducts, nextCategories, nextTransactions, nextMovements, nextExpenses, nextAuditLogs] = await Promise.all([
          fetchProducts(),
          fetchCategories(),
          fetchTransactions(),
          fetchStockMovements(),
          fetchExpenses(),
          currentUser.role === 'superadmin' ? fetchAuditLogs() : Promise.resolve([]),
        ]);

        setProducts(nextProducts);
        setCategories(nextCategories);
        setTransactions(nextTransactions);
        setStockMovements(nextMovements);
        setExpenses(nextExpenses);
        if (currentUser.role === 'superadmin') setAuditLogs(nextAuditLogs);
      } catch {
        // ignore polling errors
      }
    };

    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [currentUser]);

  return {
    products,
    transactions,
    users,
    categories,
    stockMovements,
    auditLogs,
    expenses,
    settings,
    loadData,
    resetData,
    handleCreateProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    handleCreateCategory,
    handleDeleteCategory,
    handleCreateUser,
    handleUpdateUser,
    handleUpdateUserStatus,
    handleCreateTransaction,
    handleStockIn,
    handleCreateExpense,
    handleSaveSettings,
  };
}
