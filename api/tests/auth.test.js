const request = require('supertest');
const { createApp } = require('../src/app');
const { testConfig } = require('./helpers');

const app = createApp(testConfig);

describe('auth', () => {
  it('registers and returns user', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'user@test.com', password: 'password123' })
      .expect(201);

    expect(res.body.user.email).toBe('user@test.com');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects duplicate email', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'dup@test.com', password: 'password123' });

    await request(app)
      .post('/auth/register')
      .send({ email: 'dup@test.com', password: 'password123' })
      .expect(409);
  });

  it('logs in with valid credentials', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'login@test.com', password: 'password123' });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'login@test.com', password: 'password123' })
      .expect(200);

    expect(res.body.user.email).toBe('login@test.com');
  });

  it('returns current user with session cookie', async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/register')
      .send({ email: 'me@test.com', password: 'password123' });

    const res = await agent.get('/auth/me').expect(200);
    expect(res.body.user.email).toBe('me@test.com');
  });

  it('clears session on logout', async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/register')
      .send({ email: 'logout@test.com', password: 'password123' });

    await agent.post('/auth/logout').expect(200);
    await agent.get('/auth/me').expect(401);
  });

  it('rejects /auth/me without session', async () => {
    await request(app).get('/auth/me').expect(401);
  });

  it('rejects login with wrong password', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'badpass@test.com', password: 'password123' });

    await request(app)
      .post('/auth/login')
      .send({ email: 'badpass@test.com', password: 'wrongpassword' })
      .expect(401);
  });
});
