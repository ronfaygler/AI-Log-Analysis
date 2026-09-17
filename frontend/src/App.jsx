import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api/client';
import { Layout } from './components/Layout';
import { ApiKeys } from './pages/ApiKeys';
import { LogDetail } from './pages/LogDetail';
import { Login } from './pages/Login';
import { Logs } from './pages/Logs';
import { Register } from './pages/Register';

function ProtectedRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="auth-page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/logs" /> : <Login onAuth={setUser} />} />
      <Route
        path="/register"
        element={user ? <Navigate to="/logs" /> : <Register onAuth={setUser} />}
      />
      <Route
        path="/logs"
        element={
          <ProtectedRoute user={user}>
            <Layout user={user} onLogout={() => setUser(null)}>
              <Logs user={user} />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/logs/:id"
        element={
          <ProtectedRoute user={user}>
            <Layout user={user} onLogout={() => setUser(null)}>
              <LogDetail />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/keys"
        element={
          <ProtectedRoute user={user}>
            <Layout user={user} onLogout={() => setUser(null)}>
              <ApiKeys />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to={user ? '/logs' : '/login'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
