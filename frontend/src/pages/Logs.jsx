import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, DEMO_MODE, DEMO_USER_EMAIL } from '../api/client';
import { LevelBadge, SeverityBadge, StatusBadge } from '../components/Badge';
import { useLogStream } from '../hooks/useLogStream';
import './Logs.css';

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function snippet(text, max = 80) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function Logs({ user }) {
  const isDemoAccount = DEMO_MODE && user?.email === DEMO_USER_EMAIL;
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState('');
  const [logs, setLogs] = useState([]);
  const [updatedIds, setUpdatedIds] = useState(() => new Set());
  const logsRef = useRef(logs);
  logsRef.current = logs;
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('issues');
  const [filters, setFilters] = useState({
    level: '',
    status: '',
    source: '',
    q: '',
    severity: '',
    sort: 'time',
  });

  const loadLogs = useCallback(
    async ({ fresh = false, silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const params = { limit, page };
        if (viewMode === 'issues') params.issues = true;
        if (filters.level) params.level = filters.level;
        if (filters.status) params.status = filters.status;
        if (filters.source) params.source = filters.source;
        if (filters.q) params.q = filters.q;
        if (filters.severity) params.severity = filters.severity;
        if (filters.sort && filters.sort !== 'time') params.sort = filters.sort;
        if (fresh) params.fresh = true;
        const data = await api.listLogs(params);
        setLogs(data.logs);
        if (data.limit) setLimit(data.limit);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      } catch (err) {
        if (!silent) setError(err.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [filters, viewMode, limit, page]
  );

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    setPage(1);
  }, [viewMode, filters]);

  const patchLog = useCallback(async (logId) => {
    try {
      const { log } = await api.getLog(logId);
      setLogs((prev) => prev.map((l) => (l._id === logId ? log : l)));
      setUpdatedIds((prev) => new Set([...prev, logId]));
      setTimeout(() => {
        setUpdatedIds((prev) => {
          const next = new Set(prev);
          next.delete(logId);
          return next;
        });
      }, 2000);
    } catch {
      loadLogs({ fresh: true, silent: true });
    }
  }, [loadLogs]);

  useLogStream((event, data) => {
    if (event === 'log.deleted' && data?.logEntryId) {
      setLogs((prev) => prev.filter((l) => l._id !== data.logEntryId));
      return;
    }
    if (event === 'log.updated' && data?.logEntryId) {
      if (logsRef.current.some((l) => l._id === data.logEntryId)) {
        patchLog(data.logEntryId);
      } else {
        loadLogs({ fresh: true, silent: true });
      }
      return;
    }
    loadLogs({ fresh: true, silent: true });
  });

  function handleFilterChange(e) {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function handleSearch(e) {
    e.preventDefault();
    loadLogs({ fresh: true });
  }

  async function handleSeedDemo() {
    setSeedError('');
    setSeeding(true);
    try {
      await api.seedDemo();
      await loadLogs({ fresh: true });
    } catch (err) {
      setSeedError(err.status === 429 ? err.message : `Failed to generate demo logs: ${err.message}`);
    } finally {
      setTimeout(() => setSeeding(false), 10000);
    }
  }

  async function handleDelete(e, logId) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this log permanently?')) return;
    try {
      await api.deleteLog(logId);
      setLogs((prev) => prev.filter((l) => l._id !== logId));
    } catch (err) {
      setError(err.message);
    }
  }

  const footerLabel =
    viewMode === 'issues'
      ? `Page ${page} of ${totalPages} — ${total} issue${total === 1 ? '' : 's'} total (max 500)`
      : `Page ${page} of ${totalPages} — ${total} log${total === 1 ? '' : 's'} total (max 500)`;

  const pagination = (
    <div className="pagination">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        disabled={page <= 1}
      >
        Previous
      </button>
      <span className="muted">
        Page {page} / {totalPages}
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        disabled={page >= totalPages}
      >
        Next
      </button>
    </div>
  );

  return (
    <div className="logs-page">
      <div className="page-header">
        <h1>Logs</h1>
        <div className="page-header-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadLogs({ fresh: true })} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {isDemoAccount && (
        <div className="demo-banner">
          <div>
            <strong>Demo mode</strong>
            <p className="muted">Populate this dashboard with sample logs and AI analysis — no real data, no cost.</p>
          </div>
          <button type="button" className="btn btn-primary demo-banner-btn" onClick={handleSeedDemo} disabled={seeding}>
            {seeding ? 'Generating…' : '✨ Regenerate demo logs'}
          </button>
        </div>
      )}
      {isDemoAccount && seedError && <p className="page-error">{seedError}</p>}

      <div className="view-tabs">
        <button
          type="button"
          className={`view-tab ${viewMode === 'issues' ? 'active' : ''}`}
          onClick={() => setViewMode('issues')}
        >
          Issues
        </button>
        <button
          type="button"
          className={`view-tab ${viewMode === 'all' ? 'active' : ''}`}
          onClick={() => setViewMode('all')}
        >
          All logs
        </button>
      </div>

      <form className="filters" onSubmit={handleSearch}>
        <select name="level" value={filters.level} onChange={handleFilterChange}>
          <option value="">All levels</option>
          <option value="debug">debug</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
          <option value="fatal">fatal</option>
        </select>
        <select name="status" value={filters.status} onChange={handleFilterChange}>
          <option value="">All statuses</option>
          <option value="queued">queued</option>
          <option value="processing">processing</option>
          <option value="done">done</option>
          <option value="failed">failed</option>
        </select>
        <select name="severity" value={filters.severity} onChange={handleFilterChange}>
          <option value="">All severities</option>
          <option value="critical">critical</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
          <option value="none">none</option>
        </select>
        <select name="sort" value={filters.sort} onChange={handleFilterChange}>
          <option value="time">Newest</option>
          <option value="severity">Severity (highest first)</option>
        </select>
        <input
          type="text"
          name="source"
          placeholder="Source"
          value={filters.source}
          onChange={handleFilterChange}
        />
        <input
          type="search"
          name="q"
          placeholder="Search message…"
          value={filters.q}
          onChange={handleFilterChange}
        />
        <button type="submit" className="btn btn-primary btn-sm">
          Apply
        </button>
      </form>

      {error && <p className="page-error">{error}</p>}
      {loading && <p className="muted">Loading logs…</p>}

      {!loading && !error && logs.length === 0 && (
        <div className="empty-state">
          <p>{viewMode === 'issues' ? 'No issues found.' : 'No logs yet.'}</p>
          <p className="muted">
            {viewMode === 'issues'
              ? 'Benign logs are hidden. Switch to All logs or ingest new errors.'
              : isDemoAccount
                ? 'Click "Regenerate demo logs" above to populate this dashboard.'
                : (
                  <>
                    Create an API key and send logs with{' '}
                    <code className="mono">POST /logs/ingest</code>.
                  </>
                )}
          </p>
        </div>
      )}

      {!loading && logs.length > 0 && (
        <>
          <div className="pagination-bar pagination-bar--top">
            <p className="logs-footer muted">{footerLabel}</p>
            {pagination}
          </div>
          <div className="table-wrap">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Level</th>
                  <th>Source</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} className={updatedIds.has(log._id) ? 'row--updated' : undefined}>
                    <td className="mono time-cell">{formatTime(log.loggedAt)}</td>
                    <td>
                      <LevelBadge level={log.level} />
                    </td>
                    <td className="source-cell">{log.source || '—'}</td>
                    <td>
                      <Link to={`/logs/${log._id}`} className="log-link">
                        {snippet(log.message)}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge status={log.status} />
                    </td>
                    <td>
                      <SeverityBadge severity={log.analysis?.severity} />
                    </td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-danger"
                        title="Delete log"
                        onClick={(e) => handleDelete(e, log._id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination-bar pagination-bar--bottom">
            <p className="logs-footer muted">{footerLabel}</p>
            {pagination}
          </div>
        </>
      )}
    </div>
  );
}
