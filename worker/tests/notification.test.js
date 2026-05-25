const { sendNotification } = require('../src/services/notification');

describe('sendNotification', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('skips webhook when URL is not configured', async () => {
    global.fetch = jest.fn();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    await sendNotification({ notifyWebhookUrl: '' }, {
      event: 'log.analyzed',
      logEntryId: 'abc',
      level: 'error',
      message: 'test',
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('POSTs to webhook when configured', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    await sendNotification(
      { notifyWebhookUrl: 'https://hooks.example.com/log' },
      {
        event: 'log.analyzed',
        logEntryId: 'abc123',
        level: 'error',
        message: 'timeout',
        analysis: { summary: 'x', severity: 'high', recommendation: 'y' },
      }
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://hooks.example.com/log',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.event).toBe('log.analyzed');
    expect(body.logEntryId).toBe('abc123');
  });

  it('throws when webhook returns non-ok status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Error' });

    await expect(
      sendNotification(
        { notifyWebhookUrl: 'https://hooks.example.com/log' },
        { event: 'log.failed', logEntryId: 'x', level: 'error', message: 'm', error: 'fail' }
      )
    ).rejects.toThrow('Webhook failed');
  });
});
