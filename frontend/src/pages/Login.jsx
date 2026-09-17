import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, DEMO_MODE } from '../api/client';
import '../components/AuthForm.css';

export function Login({ onAuth }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(email, password);
      onAuth(data.user);
      navigate('/logs');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleViewDemo() {
    setError('');
    setDemoLoading(true);
    try {
      const data = await api.demoLogin();
      onAuth(data.user);
      navigate('/logs');
    } catch (err) {
      setError(err.message);
    } finally {
      setDemoLoading(false);
    }
  }

  if (DEMO_MODE) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>LogSentinel</h1>
          <p className="subtitle">AI-powered log analysis — try the live demo</p>
          {error && <p className="auth-error">{error}</p>}
          <button type="button" className="btn btn-primary" onClick={handleViewDemo} disabled={demoLoading}>
            {demoLoading ? 'Loading demo…' : 'View live demo'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>LogSentinel</h1>
        <p className="subtitle">Sign in to your dashboard</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <p className="auth-error">{error}</p>}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="auth-footer">
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
