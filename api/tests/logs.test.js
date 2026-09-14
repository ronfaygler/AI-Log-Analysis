const request = require('supertest');
const { createApp } = require('../src/app');
const {
  publishJob,
  getCacheJson,
  setCacheJson,
  publishLogEvent,
  invalidateUserLogCaches,
  deleteCacheKey,
} = require('../src/db/redis');
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
    publishJob.mockReset();
    getCacheJson.mockReset();
    setCacheJson.mockReset();
    publishLogEvent.mockReset();
    invalidateUserLogCaches.mockReset();
    deleteCacheKey.mockReset();
    publishJob.mockResolvedValue(undefined);
    getCacheJson.mockResolvedValue(null);
    setCacheJson.mockResolvedValue(undefined);
    publishLogEvent.mockResolvedValue(undefined);
    invalidateUserLogCaches.mockResolvedValue(undefined);
    deleteCacheKey.mockResolvedValue(undefined);
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

  it('paginates logs 50 per page and reports totalPages', async () => {
    const agent = request.agent(app);
    const apiKey = await registerAndGetApiKey(agent);

    for (let i = 0; i < 60; i++) {
      await request(app)
        .post('/logs/ingest')
        .set('X-API-Key', apiKey)
        .send({ level: 'info', message: `log ${i}` });
    }

    const page1 = await agent.get('/logs?fresh=1').expect(200);
    expect(page1.body.logs).toHaveLength(50);
    expect(page1.body.page).toBe(1);
    expect(page1.body.total).toBe(60);
    expect(page1.body.totalPages).toBe(2);

    const page2 = await agent.get('/logs?page=2&fresh=1').expect(200);
    expect(page2.body.logs).toHaveLength(10);
    expect(page2.body.page).toBe(2);
  });

  it('caps total listable logs at 500 even if more exist', async () => {
    const agent = request.agent(app);
    const apiKey = await registerAndGetApiKey(agent);
    const mongoose = require('mongoose');

    const meRes = await agent.get('/auth/me').expect(200);
    const userId = meRes.body.user.id;
    const apiKeyId = new mongoose.Types.ObjectId();

    await LogEntry.insertMany(
      Array.from({ length: 510 }, (_, i) => ({
        userId,
        apiKeyId,
        level: 'info',
        message: `bulk ${i}`,
        loggedAt: new Date(),
        status: 'done',
      }))
    );

    const res = await agent.get('/logs?fresh=1').expect(200);
    expect(res.body.total).toBe(500);
    expect(res.body.totalPages).toBe(10);

    const lastPage = await agent.get('/logs?page=10&fresh=1').expect(200);
    expect(lastPage.body.logs).toHaveLength(50);

    const beyond = await agent.get('/logs?page=11&fresh=1').expect(200);
    expect(beyond.body.logs).toHaveLength(0);
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

  it('caches log list responses in Redis', async () => {
    const agent = request.agent(app);
    const apiKey = await registerAndGetApiKey(agent);

    await request(app)
      .post('/logs/ingest')
      .set('X-API-Key', apiKey)
      .send({ level: 'info', message: 'cache me' });

    getCacheJson.mockResolvedValueOnce(null);
    await agent.get('/logs').expect(200);
    expect(setCacheJson).toHaveBeenCalled();
    expect(setCacheJson.mock.calls[0][2]).toBe(testConfig.logsCacheTtlSeconds);
  });

  it('returns 404 for unknown log id', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ email: uniqueEmail('404'), password: 'password123' });

    await agent
      .get('/logs/507f1f77bcf86cd799439011')
      .expect(404);
  });

  it('filters issues-only logs', async () => {
    const email = uniqueEmail('issues');
    const agent = request.agent(app);
    const reg = await agent.post('/auth/register').send({ email, password: 'password123' });
    const userId = reg.body.user.id;
    const apiKey = (await agent.post('/keys').send({ name: 'issues-key' }).expect(201)).body.key;
    const ApiKey = require('../src/models/ApiKey');
    const keyDoc = await ApiKey.findOne({ userId });

    await LogEntry.create({
      userId,
      apiKeyId: keyDoc._id,
      level: 'info',
      message: 'benign done',
      loggedAt: new Date(),
      status: 'done',
      analysis: { severity: 'low', summary: 'ok' },
    });
    await LogEntry.create({
      userId,
      apiKeyId: keyDoc._id,
      level: 'error',
      message: 'failed analysis',
      loggedAt: new Date(),
      status: 'failed',
    });
    await LogEntry.create({
      userId,
      apiKeyId: keyDoc._id,
      level: 'warn',
      message: 'high severity',
      loggedAt: new Date(),
      status: 'done',
      analysis: { severity: 'high', summary: 'bad' },
    });

    const issues = await agent.get('/logs?issues=true').expect(200);
    expect(issues.body.logs).toHaveLength(2);
    const messages = issues.body.logs.map((l) => l.message);
    expect(messages).toContain('failed analysis');
    expect(messages).toContain('high severity');
    expect(messages).not.toContain('benign done');

    await request(app)
      .post('/logs/ingest')
      .set('X-API-Key', apiKey)
      .send({ level: 'error', message: 'in-flight error' })
      .expect(202);

    const withInflight = await agent.get('/logs?issues=true').expect(200);
    expect(withInflight.body.logs.some((l) => l.message === 'in-flight error')).toBe(true);
  });

  it('filters by severity and sorts by severity', async () => {
    const agent = request.agent(app);
    const reg = await agent.post('/auth/register').send({
      email: uniqueEmail('severity'),
      password: 'password123',
    });
    const userId = reg.body.user.id;
    await agent.post('/keys').send({ name: 'severity-key' }).expect(201);
    const ApiKey = require('../src/models/ApiKey');
    const keyDoc = await ApiKey.findOne({ userId });

    const base = {
      userId,
      apiKeyId: keyDoc._id,
      loggedAt: new Date(),
      status: 'done',
    };
    await LogEntry.create({ ...base, level: 'warn', message: 'low one', analysis: { severity: 'low' } });
    await LogEntry.create({ ...base, level: 'error', message: 'critical one', analysis: { severity: 'critical' } });
    await LogEntry.create({ ...base, level: 'error', message: 'medium one', analysis: { severity: 'medium' } });

    const criticalOnly = await agent.get('/logs?severity=critical').expect(200);
    expect(criticalOnly.body.logs).toHaveLength(1);
    expect(criticalOnly.body.logs[0].message).toBe('critical one');

    const sorted = await agent.get('/logs?sort=severity').expect(200);
    expect(sorted.body.logs.map((l) => l.analysis.severity)).toEqual(['critical', 'medium', 'low']);
  });

  it('bypasses cache when fresh=1', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/register').send({ email: uniqueEmail('fresh'), password: 'password123' });
    const apiKey = (await agent.post('/keys').send({ name: 'fresh-key' }).expect(201)).body.key;

    await request(app)
      .post('/logs/ingest')
      .set('X-API-Key', apiKey)
      .send({ level: 'info', message: 'fresh test' });

    const fresh = await agent.get('/logs?fresh=1').expect(200);
    expect(fresh.body.logs[0].message).toBe('fresh test');
    expect(getCacheJson).not.toHaveBeenCalled();

    getCacheJson.mockResolvedValue({ logs: [{ message: 'stale from cache' }] });
    const cached = await agent.get('/logs').expect(200);
    expect(cached.body.logs[0].message).toBe('stale from cache');
    expect(getCacheJson).toHaveBeenCalled();
  });

  it('deletes a log and returns 404 for other users', async () => {
    const emailA = uniqueEmail('del-a');
    const emailB = uniqueEmail('del-b');
    const agentA = request.agent(app);
    const agentB = request.agent(app);

    await agentA.post('/auth/register').send({ email: emailA, password: 'password123' });
    await agentB.post('/auth/register').send({ email: emailB, password: 'password123' });
    const apiKeyA = (await agentA.post('/keys').send({ name: 'del-key' }).expect(201)).body.key;

    const created = await request(app)
      .post('/logs/ingest')
      .set('X-API-Key', apiKeyA)
      .send({ level: 'error', message: 'delete me' })
      .expect(202);

    await agentA.delete(`/logs/${created.body.id}`).expect(200);
    expect(publishLogEvent).toHaveBeenCalledWith(
      expect.any(String),
      created.body.id,
      'log.deleted'
    );
    expect(invalidateUserLogCaches).toHaveBeenCalled();
    expect(deleteCacheKey).toHaveBeenCalled();

    await agentA.get(`/logs/${created.body.id}`).expect(404);
    await agentB.delete(`/logs/${created.body.id}`).expect(404);
  });
});
