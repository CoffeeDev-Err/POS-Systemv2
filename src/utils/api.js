const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function getAuthToken() {
  return localStorage.getItem('pos_token');
}

function setAuthToken(token) {
  localStorage.setItem('pos_token', token);
}

function clearAuthToken() {
  localStorage.removeItem('pos_token');
}

async function request(path, options = {}) {
  const { method = 'GET', body, token } = options;
  const headers = { 'Content-Type': 'application/json' };
  const authToken = token || getAuthToken();
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.message) message = data.message;
    } catch {
      // ignore JSON parse errors
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

export {
  API_BASE,
  request,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
};

export async function login(username, password, role) {
  return request('/auth/login', { method: 'POST', body: { username, password, role } });
}

export async function fetchMe() {
  return request('/auth/me');
}

export async function fetchProducts() {
  return request('/products');
}

export async function createProduct(payload) {
  return request('/products', { method: 'POST', body: payload });
}

export async function updateProduct(id, payload) {
  return request(`/products/${id}`, { method: 'PUT', body: payload });
}

export async function deleteProduct(id) {
  return request(`/products/${id}`, { method: 'DELETE' });
}

export async function fetchCategories() {
  return request('/categories');
}

export async function createCategory(name) {
  return request('/categories', { method: 'POST', body: { name } });
}

export async function deleteCategory(idOrName, options = {}) {
  const encoded = encodeURIComponent(idOrName);
  const params = new URLSearchParams();
  if (options.deleteProducts) params.set('deleteProducts', 'true');
  const qs = params.toString();
  return request(`/categories/${encoded}${qs ? `?${qs}` : ''}`, { method: 'DELETE' });
}

export async function fetchUsers() {
  return request('/users');
}

export async function createUser(payload) {
  return request('/users', { method: 'POST', body: payload });
}

export async function updateUser(id, payload) {
  return request(`/users/${id}`, { method: 'PUT', body: payload });
}

export async function updateUserStatus(id, payload) {
  return request(`/users/${id}/status`, { method: 'PATCH', body: payload || {} });
}

export async function fetchTransactions() {
  return request('/transactions');
}

export async function createTransaction(payload) {
  return request('/transactions', { method: 'POST', body: payload });
}

export async function fetchStockMovements() {
  return request('/stock-movements');
}

export async function createStockMovement(payload) {
  return request('/stock-movements', { method: 'POST', body: payload });
}

export async function fetchSettings() {
  return request('/settings');
}

export async function updateSettings(payload) {
  return request('/settings', { method: 'PUT', body: payload });
}

export async function fetchAuditLogs() {
  return request('/audit-logs');
}

export async function fetchExpenses(from, to) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return request(`/expenses${qs ? `?${qs}` : ''}`);
}

export async function createExpense(payload) {
  return request('/expenses', { method: 'POST', body: payload });
}
