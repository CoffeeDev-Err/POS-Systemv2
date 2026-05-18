import { useState } from 'react';
import '../styles/login.css';

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
      const code = err.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setFormError('Incorrect username or password. Please try again.');
      } else if (code === 'auth/too-many-requests') {
        setFormError('Too many failed attempts. Please wait a moment before trying again.');
      } else if (code === 'auth/user-disabled') {
        setFormError('This account has been disabled. Contact your administrator.');
      } else if (err.message === 'Invalid username or password.' || err.message === 'This account has been deactivated.') {
        setFormError(err.message);
      } else {
        setFormError('Unable to sign in. Please check your credentials and try again.');
      }
    }
  };

  return (
    <div className="login-page d-flex align-items-center justify-content-center min-vh-100">
      <div className="login-card">
        <button
          type="button"
          className="theme-toggle login-theme-toggle"
          onClick={onToggleTheme}
          title="Toggle theme"
          aria-label="Toggle theme"
        >
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
              <button
                type="button"
                className="input-group-text bg-light"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
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

        <p className="text-center text-muted mt-4 mb-0" style={{ fontSize: '0.75rem' }}>
          <i className="bi bi-shield-lock me-1"></i>
          Secure POS v1.0
        </p>
      </div>
    </div>
  );
}
