const request = require('supertest');
const { createApp } = require('../src/app');
const { publishJob } = require('../src/db/redis');
const LogEntry = require('../src/models/LogEntry');
const { testConfig, uniqueEmail } = require('./helpers');

const app = createApp(testConfig);

async function registerAndGetApiKey(agent) {
  await agent
    .post('/auth/register')
    .send({ email: uniqueEmail('ingest'), password: 'password123' });

  const keyRes = await agent
    .post('/keys')
    .send({ name: 'test-key' })
    .expect(201);

  return keyRes.body.key;
}

describe('logs', () => {
  beforeEach(() => {
    publishJob.mockClear();
  });

  it('ingests log with API key and enqueues job', async () => {
    const agent = request.agent(app);
    const apiKey = await registerAndGetApiKey(agent);

    expect(apiKey).toMatch(/^ls_/);

    const res = await request(app)
      .post('/logs/ingest')
      .set('X-API-Key', apiKey)
      .send({
        level: 'error',
        message: 'Connection timeout',
        source: 'gateway',
      })
      .expect(202);

    expect(res.body.status).toBe('queued');
    expect(publishJob).toHaveBeenCalledTimes(1);
    expect(publishJob.mock.calls[0][0]).toBe(testConfig.redisQueueName);

    const entry = await LogEntry.findById(res.body.id);
    expect(entry.message).toBe('Connection timeout');
  });

  it('rejects ingest without API key', async () => {
    const res = await request(app)
      .post('/logs/ingest')
      .send({ level: 'info', message: 'hello' })
      .expect(401);

    expect(res.body.error).toMatch(/API-Key/i);
  });

  it('rejects invalid API key', async () => {
    await request(app)
      .post('/logs/ingest')
      .set('X-API-Key', 'ls_invalid_key_not_in_db')
      .send({ level: 'info', message: 'hello' })
      .expect(401);
  });

  it('rejects invalid log level', async () => {
    const agent = request.agent(app);
    const apiKey = await registerAndGetApiKey(agent);

    await request(app)
      .post('/logs/ingest')
      .set('X-API-Key', apiKey)
      .send({ level: 'critical', message: 'bad level' })
      .expect(400);
  });

  it('rejects missing message', async () => {
    const agent = request.agent(app);
    const apiKey = await registerAndGetApiKey(agent);

    await request(app)
      .post('/logs/ingest')
      .set('X-API-Key', apiKey)
      .send({ level: 'info' })
      .expect(400);
  });

  it('lists logs for authenticated user', async () => {
    const agent = request.agent(app);
    const apiKey = await registerAndGetApiKey(agent);

    await request(app)
      .post('/logs/ingest')
      .set('X-API-Key', apiKey)
      .send({ level: 'warn', message: 'disk 90%' });

    const res = await agent.get('/logs').expect(200);
    expect(res.body.logs).toHaveLength(1);
    expect(res.body.logs[0].message).toBe('disk 90%');
  });
});
