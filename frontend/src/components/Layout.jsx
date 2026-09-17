import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api, DEMO_USER_EMAIL } from '../api/client';
import './Layout.css';

export function Layout({ user, children, onLogout }) {
  const isDemoAccount = user.email === DEMO_USER_EMAIL;
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      onLogout();
      navigate('/login');
    }
  }

  return (
    <div className="layout">
      <header className="layout-header">
        <Link to="/logs" className="brand">
          LogSentinel
        </Link>
        <nav className="nav">
          <NavLink to="/logs" className={({ isActive }) => (isActive ? 'active' : '')}>
            Logs
          </NavLink>
          {!isDemoAccount && (
            <NavLink to="/keys" className={({ isActive }) => (isActive ? 'active' : '')}>
              API Keys
            </NavLink>
          )}
        </nav>
        <div className="header-right">
          <span className="user-email">{isDemoAccount ? 'Demo Account' : user.email}</span>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="layout-main">{children}</main>
    </div>
  );
}
