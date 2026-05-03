import { useState, useEffect } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import Products from './components/Products';
import Inventory from './components/Inventory';
import Reports from './components/Reports';
import Users from './components/Users';
import Settings from './components/Settings';
import { PRODUCTS, TRANSACTIONS, USERS, CATEGORIES } from './data/mockData';
import { dbInit, dbLoad, dbSave } from './utils/localDb';

// Seed localStorage with mock data on first run
dbInit('products',     PRODUCTS);
dbInit('transactions', TRANSACTIONS);
dbInit('users',        USERS);
dbInit('categories',   CATEGORIES);

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');

  // Load from localStorage on first mount
  const [products,     setProductsRaw]     = useState(() => dbLoad('products')     || PRODUCTS);
  const [transactions, setTransactionsRaw] = useState(() => dbLoad('transactions') || TRANSACTIONS);
  const [users,        setUsersRaw]        = useState(() => dbLoad('users')        || USERS);
  const [categories,   setCategoriesRaw]   = useState(() => dbLoad('categories')   || CATEGORIES);

  // Wrappers that persist to localStorage on every update
  const setProducts = (updater) => {
    setProductsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      dbSave('products', next);
      return next;
    });
  };

  const setTransactions = (updater) => {
    setTransactionsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      dbSave('transactions', next);
      return next;
    });
  };

  const setUsers = (updater) => {
    setUsersRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      dbSave('users', next);
      return next;
    });
  };

  const setCategories = (updater) => {
    setCategoriesRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      dbSave('categories', next);
      return next;
    });
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    setCurrentPage(user.role === 'cashier' ? 'pos' : 'dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentPage('dashboard');
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} users={users} />;
  }

  const renderPage = () => {
    const props = { products, setProducts, transactions, setTransactions, users, setUsers, categories, setCategories, currentUser };
    switch (currentPage) {
      case 'dashboard': return <Dashboard {...props} />;
      case 'pos':       return <POS {...props} />;
      case 'products':  return <Products {...props} />;
      case 'inventory': return <Inventory {...props} />;
      case 'reports':   return <Reports {...props} />;
      case 'users':     return <Users {...props} />;
      case 'settings':  return <Settings />;
      default:          return <Dashboard {...props} />;
    }
  };

  return (
    <Layout currentUser={currentUser} currentPage={currentPage} setCurrentPage={setCurrentPage} onLogout={handleLogout}>
      {renderPage()}
    </Layout>
  );
}
