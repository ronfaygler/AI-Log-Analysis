import { useState } from 'react';
import './HowItWorks.css';

export function HowItWorks({ isDemoAccount }) {
  // Always starts open on page entry; Hide only lasts until the page is left.
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return (
      <button type="button" className="how-it-works-show" onClick={() => setHidden(false)}>
        ℹ️ How it works
      </button>
    );
  }

  return (
    <section className="how-it-works" aria-labelledby="how-it-works-title">
      <div className="how-it-works-header">
        <h2 id="how-it-works-title">How LogSentinel works</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHidden(true)}>
          Hide
        </button>
      </div>
      <ol className="how-it-works-steps">
        <li>
          <strong>Ingest</strong> —{' '}
          {isDemoAccount ? (
            <>
              in this demo, <em>Regenerate demo logs</em> sends sample logs from made-up services (api-gateway,
              payments-service…). In real use, your own apps send them with an API key.
            </>
          ) : (
            <>
              your apps send logs with an API key (<code>POST /logs/ingest</code>).
            </>
          )}
        </li>
        <li>
          <strong>Queue</strong> — each log is queued in Redis and picked up in batches by a background worker.
        </li>
        <li>
          <strong>Analyze</strong> — Claude reads each batch and returns a summary, a severity and a recommended fix.
        </li>
        <li>
          <strong>Live results</strong> — the table updates in real time: Status goes queued → processing → done.
        </li>
      </ol>
      <p className="how-it-works-glossary muted">
        <strong>Issues</strong> shows only what needs attention (failed, medium+ severity, or errors still being
        analyzed); <strong>All logs</strong> shows everything. Click any message to see the full AI analysis.
        {isDemoAccount && ' Click "Regenerate demo logs" below to watch the pipeline run on sample data.'}
      </p>
    </section>
  );
}
