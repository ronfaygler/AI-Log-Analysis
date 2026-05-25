async function sendNotification(config, payload) {
  const { event, logEntryId, level, message, analysis, error } = payload;

  const body = {
    event,
    logEntryId,
    level,
    message,
    analysis,
    error,
    service: 'logsentinel-worker',
    at: new Date().toISOString(),
  };

  console.log('[notification]', JSON.stringify(body));

  if (!config.notifyWebhookUrl) {
    return;
  }

  const res = await fetch(config.notifyWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Webhook failed: ${res.status} ${res.statusText}`);
  }
}

module.exports = { sendNotification };
