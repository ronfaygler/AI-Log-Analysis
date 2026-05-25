const request = require('supertest');
const { createApp } = require('../src/app');
const { testConfig, uniqueEmail } = require('./helpers');

const app = createApp(testConfig);

describe('keys', () => {
  it('creates an API key for authenticated user', async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/register')
      .send({ email: uniqueEmail('keys'), password: 'password123' });

    const res = await agent
      .post('/keys')
      .send({ name: 'production' })
      .expect(201);

    expect(res.body.key).toMatch(/^ls_/);
    expect(res.body.keyPrefix).toBe(res.body.key.slice(0, 12));
    expect(res.body.name).toBe('production');
  });

  it('lists API keys without exposing full key', async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/register')
      .send({ email: uniqueEmail('list'), password: 'password123' });

    await agent.post('/keys').send({ name: 'key-a' }).expect(201);
    await agent.post('/keys').send({ name: 'key-b' }).expect(201);

    const res = await agent.get('/keys').expect(200);
    expect(res.body.keys).toHaveLength(2);
    expect(res.body.keys[0].key).toBeUndefined();
    expect(res.body.keys.every((k) => Boolean(k.keyPrefix))).toBe(true);
  });

  it('requires authentication', async () => {
    await request(app).post('/keys').send({ name: 'nope' }).expect(401);
    await request(app).get('/keys').expect(401);
  });
});
