import { useEffect, useState } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import Products from './components/Products';
import Inventory from './components/Inventory';
import Reports from './components/Reports';
import Users from './components/Users';
import Settings from './components/Settings';
import {
  login as apiLogin,
  fetchMe,
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
  setAuthToken,
  clearAuthToken,
  getAuthToken,
} from './utils/api';

const EMPTY_SETTINGS = {
  storeName: "CARREN'S STORE",
  address: 'Urdaneta, Ilocos',
  phone: '09XX-XXX-XXXX',
  receiptFooter: 'Salamat sa inyong pagbili! Please come again :)',
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState(EMPTY_SETTINGS);

  const safeFetch = async (fn, fallback) => {
    try {
      return await fn();
    } catch (err) {
      if (err && err.status === 403) return fallback;
      throw err;
    }
  };

  const loadData = async (role) => {
    const canManage = role === 'superadmin' || role === 'admin';
    const isSuper = role === 'superadmin';

    const results = await Promise.all([
      safeFetch(fetchProducts, []),
      safeFetch(fetchCategories, []),
      canManage ? safeFetch(fetchTransactions, []) : Promise.resolve([]),
      canManage ? safeFetch(fetchStockMovements, []) : Promise.resolve([]),
      canManage ? safeFetch(fetchExpenses, []) : Promise.resolve([]),
      isSuper ? safeFetch(fetchUsers, []) : Promise.resolve([]),
      isSuper ? safeFetch(fetchSettings, EMPTY_SETTINGS) : Promise.resolve(EMPTY_SETTINGS),
      isSuper ? safeFetch(fetchAuditLogs, []) : Promise.resolve([]),
    ]);

    setProducts(results[0]);
    setCategories(results[1]);
    setTransactions(results[2]);
    setStockMovements(results[3]);
    setExpenses(results[4]);
    setUsers(results[5]);
    setSettings(results[6] || EMPTY_SETTINGS);
    setAuditLogs(results[7]);
  };

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const bootstrap = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const { user } = await fetchMe();
        setCurrentUser(user);
        setCurrentPage(user.role === 'cashier' ? 'pos' : 'dashboard');
        await loadData(user.role);
      } catch (err) {
        clearAuthToken();
        localStorage.removeItem('pos_user');
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const handleLogin = async (username, password) => {
    setLoading(true);
    setLoadError('');
    try {
      const { user, token } = await apiLogin(username, password);
      setAuthToken(token);
      localStorage.setItem('pos_user', JSON.stringify(user));
      setCurrentUser(user);
      setCurrentPage(user.role === 'cashier' ? 'pos' : 'dashboard');
      await loadData(user.role);
    } catch (err) {
      setLoadError(err.message || 'Login failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    localStorage.removeItem('pos_user');
    setCurrentUser(null);
    setCurrentPage('dashboard');
    setLoadError('');
    setProducts([]);
    setTransactions([]);
    setUsers([]);
    setCategories([]);
    setStockMovements([]);
    setAuditLogs([]);
    setExpenses([]);
    setSettings(EMPTY_SETTINGS);
  };

  const refreshAuditLogs = async () => {
    if (currentUser?.role !== 'superadmin') return;
    try {
      const logs = await fetchAuditLogs();
      setAuditLogs(logs);
    } catch {
      // ignore refresh errors
    }
  };

  const refreshStockMovements = async () => {
    if (currentUser?.role !== 'superadmin' && currentUser?.role !== 'admin') return;
    try {
      const rows = await fetchStockMovements();
      setStockMovements(rows);
    } catch {
      // ignore refresh errors
    }
  };

  const mergeProducts = (updates) => {
    if (!Array.isArray(updates) || updates.length === 0) return;
    setProducts(prev => {
      const map = new Map(updates.map(p => [p.id, p]));
      return prev.map(p => map.get(p.id) || p);
    });
  };

  const handleCreateProduct = async (payload) => {
    const product = await createProduct(payload);
    setProducts(prev => [...prev, product]);
    setCategories(prev => (prev.includes(product.category) ? prev : [...prev, product.category]));
    refreshAuditLogs();
    return product;
  };

  const handleUpdateProduct = async (id, payload) => {
    const product = await updateProduct(id, payload);
    setProducts(prev => prev.map(p => (p.id === product.id ? product : p)));
    setCategories(prev => (prev.includes(product.category) ? prev : [...prev, product.category]));
    refreshAuditLogs();
    return product;
  };

  const handleDeleteProduct = async (id) => {
    await deleteProduct(id);
    setProducts(prev => prev.filter(p => p.id !== id));
    refreshAuditLogs();
  };

  const handleCreateCategory = async (name) => {
    const res = await createCategory(name);
    setCategories(prev => (prev.includes(res.name) ? prev : [...prev, res.name]));
    refreshAuditLogs();
    return res;
  };

  const handleDeleteCategory = async (name) => {
    await deleteCategory(name);
    setCategories(prev => prev.filter(c => c !== name));
    refreshAuditLogs();
  };

  const handleCreateUser = async (payload) => {
    const user = await createUser(payload);
    setUsers(prev => [...prev, user]);
    refreshAuditLogs();
    return user;
  };

  const handleUpdateUser = async (id, payload) => {
    const user = await updateUser(id, payload);
    setUsers(prev => prev.map(u => (u.id === user.id ? user : u)));
    refreshAuditLogs();
    return user;
  };

  const handleUpdateUserStatus = async (id, payload) => {
    const user = await updateUserStatus(id, payload);
    setUsers(prev => prev.map(u => (u.id === user.id ? user : u)));
    refreshAuditLogs();
    return user;
  };

  const handleCreateTransaction = async (payload) => {
    const res = await createTransaction(payload);
    setTransactions(prev => [...prev, res.transaction]);
    mergeProducts(res.updatedProducts);
    refreshAuditLogs();
    refreshStockMovements();
    return res.transaction;
  };

  const handleStockIn = async (payload) => {
    const res = await createStockMovement({ ...payload, type: 'stock-in' });
    setStockMovements(prev => [...prev, res.movement]);
    mergeProducts([res.product]);
    refreshAuditLogs();
    return res;
  };

  const handleCreateExpense = async (payload) => {
    const expense = await createExpense(payload);
    setExpenses(prev => [expense, ...prev]);
    return expense;
  };

  const handleSaveSettings = async (payload) => {
    const updated = await updateSettings(payload);
    setSettings(updated);
    return updated;
  };

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

  if (!currentUser) {
    return <Login onLogin={handleLogin} loading={loading} error={loadError} />;
  }

  const renderPage = () => {
    const props = {
      products,
      transactions,
      users,
      categories,
      stockMovements,
      expenses,
      auditLogs,
      settings,
      currentUser,
      onCreateProduct: handleCreateProduct,
      onUpdateProduct: handleUpdateProduct,
      onDeleteProduct: handleDeleteProduct,
      onCreateCategory: handleCreateCategory,
      onDeleteCategory: handleDeleteCategory,
      onCreateUser: handleCreateUser,
      onUpdateUser: handleUpdateUser,
      onUpdateUserStatus: handleUpdateUserStatus,
      onCreateTransaction: handleCreateTransaction,
      onStockIn: handleStockIn,
      onCreateExpense: handleCreateExpense,
      onSaveSettings: handleSaveSettings,
    };

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard {...props} />;
      case 'pos':
        return <POS {...props} />;
      case 'products':
        return <Products {...props} />;
      case 'inventory':
        return <Inventory {...props} />;
      case 'reports':
        return <Reports {...props} />;
      case 'users':
        return <Users {...props} />;
      case 'settings':
        return <Settings {...props} />;
      default:
        return <Dashboard {...props} />;
    }
  };

  return (
    <Layout currentUser={currentUser} currentPage={currentPage} setCurrentPage={setCurrentPage} onLogout={handleLogout}>
      {loading && (
        <div className="alert alert-info small mb-3">Loading data...</div>
      )}
      {loadError && (
        <div className="alert alert-danger small mb-3">{loadError}</div>
      )}
      {renderPage()}
    </Layout>
  );
}
