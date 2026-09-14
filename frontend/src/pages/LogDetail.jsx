import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { LevelBadge, SeverityBadge, StatusBadge } from '../components/Badge';
import './LogDetail.css';

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function LogDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api.getLog(id);
        if (!cancelled) setLog(data.log);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDelete() {
    if (!window.confirm('Delete this log permanently?')) return;
    setDeleting(true);
    setError('');
    try {
      await api.deleteLog(id);
      navigate('/logs');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (error && !log) return <p className="page-error">{error}</p>;
  if (!log) return null;

  return (
    <div className="log-detail">
      <div className="detail-toolbar">
        <Link to="/logs" className="back-link">
          ← Back to logs
        </Link>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-danger"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Deleting…' : 'Delete log'}
        </button>
      </div>

      {error && <p className="page-error">{error}</p>}

      <header className="detail-header">
        <div className="badges">
          <LevelBadge level={log.level} />
          <StatusBadge status={log.status} />
          {log.analysis?.severity && <SeverityBadge severity={log.analysis.severity} />}
        </div>
        <h1 className="detail-message">{log.message}</h1>
        <p className="detail-meta mono">
          {formatTime(log.loggedAt)}
          {log.source && <> · {log.source}</>}
        </p>
      </header>

      {log.analysis && (
        <section className="detail-section analysis-card">
          <h2>AI analysis</h2>
          <dl>
            <dt>Summary</dt>
            <dd>{log.analysis.summary}</dd>
            <dt>Recommendation</dt>
            <dd>{log.analysis.recommendation}</dd>
            {log.analysis.analyzedAt && (
              <>
                <dt>Analyzed at</dt>
                <dd className="mono">{formatTime(log.analysis.analyzedAt)}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {log.status === 'failed' && log.errorMessage && (
        <section className="detail-section error-card">
          <h2>Processing error</h2>
          <pre className="mono">{log.errorMessage}</pre>
        </section>
      )}

      {log.metadata && Object.keys(log.metadata).length > 0 && (
        <section className="detail-section">
          <h2>Metadata</h2>
          <pre className="metadata-json mono">{JSON.stringify(log.metadata, null, 2)}</pre>
        </section>
      )}

      <section className="detail-section">
        <h2>Raw entry</h2>
        <pre className="metadata-json mono">{JSON.stringify(log, null, 2)}</pre>
      </section>
    </div>
  );
}
