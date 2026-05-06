import { useState } from 'react';

const DEMO_USERS = [
  { label: 'Owner',   icon: 'bi-shield-fill-check', color: 'danger',  username: 'owner',    password: 'owner123' },
  { label: 'Admin',   icon: 'bi-person-badge-fill', color: 'warning', username: 'admin',    password: 'admin123' },
  { label: 'Cashier', icon: 'bi-cash-coin',         color: 'success', username: 'cashier1', password: 'cashier123' },
];

export default function Login({ onLogin, loading, error, theme, onToggleTheme }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await onLogin(username, password);
    } catch (err) {
      setFormError(err.message || 'Invalid username or password. Please try again.');
    }
  };

  const quickLogin = (demo) => {
    setUsername(demo.username);
    setPassword(demo.password);
  };

  return (
    <div className="login-page d-flex align-items-center justify-content-center min-vh-100">
      <div className="login-card">
        <button type="button" className="theme-toggle login-theme-toggle" onClick={onToggleTheme} title="Toggle theme">
          <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon-stars'}`}></i>
        </button>
        {/* Logo */}
        <div className="text-center mb-4">
          <div className="store-logo mb-2">
            <i className="bi bi-shop-window"></i>
          </div>
          <h1 className="store-name">CARREN'S STORE</h1>
          <p className="store-sub">Point of Sale System</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} autoComplete="off">
          {(formError || error) && (
            <div className="alert alert-danger d-flex align-items-center gap-2 py-2" role="alert">
              <i className="bi bi-exclamation-circle-fill"></i>
              <small>{formError || error}</small>
            </div>
          )}
          <div className="mb-3">
            <label className="form-label fw-semibold">Username</label>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-person text-secondary"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="form-label fw-semibold">Password</label>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-lock text-secondary"></i>
              </span>
              <input
                type={showPass ? 'text' : 'password'}
                className="form-control border-start-0 border-end-0 ps-0"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button type="button" className="input-group-text bg-light" onClick={() => setShowPass(!showPass)}>
                <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'} text-secondary`}></i>
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-100 login-btn" disabled={loading}>
            {loading
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Signing in...</>
              : <><i className="bi bi-box-arrow-in-right me-2"></i>Sign In</>
            }
          </button>
        </form>

        {/* Quick login demo */}
        <div className="mt-4">
          <p className="text-center text-muted small mb-2">— Quick Login (Demo) —</p>
          <div className="row g-2">
            {DEMO_USERS.map((demo) => (
              <div className="col-4" key={demo.label}>
                <button
                  type="button"
                  className={`btn btn-outline-${demo.color} btn-sm w-100 quick-btn`}
                  onClick={() => quickLogin(demo)}
                  disabled={loading}
                >
                  <i className={`bi ${demo.icon} d-block mb-1`}></i>
                  <small>{demo.label}</small>
                </button>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-muted mt-4 mb-0" style={{ fontSize: '0.75rem' }}>
          <i className="bi bi-shield-lock me-1"></i>
          Secure POS v1.0
        </p>
      </div>
    </div>
  );
}
