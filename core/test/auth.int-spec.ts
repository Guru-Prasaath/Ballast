import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { runMigrations } from '../src/database/migrate';

/**
 * End-to-end auth flow against a real Postgres: signup provisions an account,
 * login and refresh issue tokens, and /me is gated by the JWT guard.
 * Requires Docker (Testcontainers); runs in CI via `npm run test:int`.
 */
describe('Auth (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;

  const creds = {
    orgName: 'Northwind Labs',
    name: 'Ada Okoye',
    email: 'ada@northwind.dev',
    password: 'demo-password-1',
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    process.env.DATABASE_URL = container.getConnectionUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-16-chars';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-16-chars';
    process.env.NODE_ENV = 'test';

    await runMigrations(process.env.DATABASE_URL);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  const http = () => request(app.getHttpServer());

  it('signs up, provisioning an owner and a default queue', async () => {
    const res = await http().post('/api/v1/auth/signup').send(creds);

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(creds.email);
    expect(res.body.user.role).toBe('owner');
    expect(res.body.org.name).toBe(creds.orgName);
    expect(res.body.tokens.accessToken).toEqual(expect.any(String));
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await http().post('/api/v1/auth/signup').send(creds);
    expect(res.status).toBe(409);
  });

  it('rejects an invalid signup body with 400', async () => {
    const res = await http()
      .post('/api/v1/auth/signup')
      .send({ orgName: 'X', name: 'Y', email: 'not-an-email', password: 'x' });
    expect(res.status).toBe(400);
  });

  it('logs in and returns the account and tokens', async () => {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: creds.email, password: creds.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(creds.email);
    expect(res.body.tokens.accessToken).toEqual(expect.any(String));
  });

  it('rejects a wrong password with 401', async () => {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ email: creds.email, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('gates /me behind a valid access token', async () => {
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: creds.email, password: creds.password });
    const { accessToken, refreshToken } = login.body.tokens;

    await http().get('/api/v1/me').expect(401);

    const me = await http()
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(creds.email);
    expect(me.body.org.slug).toEqual(expect.any(String));

    const refreshed = await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));
  });
});
