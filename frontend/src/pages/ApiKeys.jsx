import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import './ApiKeys.css';

function formatTime(iso) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString();
}

export function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listKeys();
      setKeys(data.keys);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    setNewKey(null);
    try {
      const data = await api.createKey(name.trim());
      setNewKey(data);
      setName('');
      await loadKeys();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function copyKey() {
    if (newKey?.key) {
      navigator.clipboard.writeText(newKey.key);
    }
  }

  return (
    <div className="keys-page">
      <h1>API Keys</h1>
      <p className="muted keys-intro">
        Use keys in the <code className="mono">X-API-Key</code> header when calling{' '}
        <code className="mono">POST /logs/ingest</code>.
      </p>

      <form className="create-key-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Key name (e.g. production-api)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
          {creating ? 'Creating…' : 'Create key'}
        </button>
      </form>

      {error && <p className="page-error">{error}</p>}

      {newKey && (
        <div className="new-key-banner" role="alert">
          <p>
            <strong>Copy your new key now</strong> — it will not be shown again.
          </p>
          <code className="mono key-value">{newKey.key}</code>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyKey}>
            Copy to clipboard
          </button>
        </div>
      )}

      {loading && <p className="muted">Loading keys…</p>}

      {!loading && keys.length === 0 && (
        <p className="muted">No API keys yet. Create one above.</p>
      )}

      {!loading && keys.length > 0 && (
        <ul className="keys-list">
          {keys.map((key) => (
            <li key={key._id} className="key-item">
              <div>
                <span className="key-name">{key.name}</span>
                <span className="mono key-prefix">{key.keyPrefix}…</span>
              </div>
              <div className="key-meta muted">
                Created {formatTime(key.createdAt)}
                {key.lastUsedAt && <> · Last used {formatTime(key.lastUsedAt)}</>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
