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

  it('gets a log by id with bearer token', async () => {
    const email = uniqueEmail('bearer-get');
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ email, password: 'password123' });

    const apiKey = (await agent.post('/keys').send({ name: 'get-log-key' }).expect(201)).body.key;

    const created = await request(app)
      .post('/logs/ingest')
      .set('X-API-Key', apiKey)
      .send({ level: 'info', message: 'fetch me' })
      .expect(202);

    const loginRes = await agent.post('/auth/login').send({ email, password: 'password123' });
    const tokenMatch = loginRes.headers['set-cookie']?.[0]?.match(/logsentinel_token=([^;]+)/);
    const token = tokenMatch[1];

    const res = await request(app)
      .get(`/logs/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.log.message).toBe('fetch me');
  });

  it('filters and searches logs', async () => {
    const email = uniqueEmail('filter');
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ email, password: 'password123' });
    const apiKey = (await agent.post('/keys').send({ name: 'filter-key' }).expect(201)).body.key;

    await request(app)
      .post('/logs/ingest')
      .set('X-API-Key', apiKey)
      .send({ level: 'error', message: 'payment failed', source: 'checkout' });
    await request(app)
      .post('/logs/ingest')
      .set('X-API-Key', apiKey)
      .send({ level: 'info', message: 'payment ok', source: 'checkout' });

    const errors = await agent.get('/logs?level=error').expect(200);
    expect(errors.body.logs).toHaveLength(1);
    expect(errors.body.logs[0].message).toBe('payment failed');

    const search = await agent.get('/logs?q=payment').expect(200);
    expect(search.body.logs).toHaveLength(2);

    const bySource = await agent.get('/logs?source=checkout&limit=1').expect(200);
    expect(bySource.body.logs).toHaveLength(1);
  });

  it('returns 404 for unknown log id', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ email: uniqueEmail('404'), password: 'password123' });

    await agent
      .get('/logs/507f1f77bcf86cd799439011')
      .expect(404);
  });
});
