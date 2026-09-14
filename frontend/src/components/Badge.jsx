import './Badge.css';

const LEVEL_CLASS = {
  debug: 'level-debug',
  info: 'level-info',
  warn: 'level-warn',
  error: 'level-error',
  fatal: 'level-fatal',
};

const SEVERITY_CLASS = {
  low: 'sev-low',
  medium: 'sev-medium',
  high: 'sev-high',
  critical: 'sev-critical',
};

export function LevelBadge({ level }) {
  return <span className={`badge ${LEVEL_CLASS[level] || ''}`}>{level}</span>;
}

export function StatusBadge({ status }) {
  return <span className={`badge status-${status}`}>{status}</span>;
}

export function SeverityBadge({ severity }) {
  if (!severity) return <span className="badge muted">—</span>;
  const key = severity.toLowerCase();
  return <span className={`badge ${SEVERITY_CLASS[key] || 'sev-medium'}`}>{severity}</span>;
}
