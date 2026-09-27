import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import './SourceFilter.css';

export function SourceFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setLoading(true);
    api
      .listSources()
      .then((data) => setSources(data.sources || []))
      .catch(() => setSources([]))
      .finally(() => setLoading(false));

    function handleOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  function toggle(source) {
    onChange(value.includes(source) ? value.filter((s) => s !== source) : [...value, source]);
  }

  // Keep selected values visible even if they no longer exist in the data.
  const options = [...new Set([...sources, ...value])].sort((a, b) => a.localeCompare(b));

  const label =
    value.length === 0 ? 'All sources' : value.length === 1 ? value[0] : `${value.length} sources`;

  return (
    <div className="source-filter" ref={rootRef}>
      <button
        type="button"
        className={`source-filter-toggle ${value.length ? 'has-value' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="The service or app that sent the log"
      >
        <span className="source-filter-label">{label}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="source-filter-menu" role="listbox" aria-multiselectable="true">
          {loading && options.length === 0 && <p className="source-filter-empty muted">Loading…</p>}
          {!loading && options.length === 0 && <p className="source-filter-empty muted">No sources yet</p>}
          {options.map((source) => (
            <label key={source} className="source-filter-option">
              <input type="checkbox" checked={value.includes(source)} onChange={() => toggle(source)} />
              <span>{source}</span>
            </label>
          ))}
          {value.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm source-filter-clear" onClick={() => onChange([])}>
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
