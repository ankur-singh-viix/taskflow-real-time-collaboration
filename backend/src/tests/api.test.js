const request = require('supertest');
const { app } = require('../src/index');
const { initDb, dbRun } = require('../src/db/database');

let authToken = '';
let boardId = '';
let listId = '';
let taskId = '';

beforeAll(async () => {
  process.env.DB_PATH = ':memory:';
  process.env.JWT_SECRET = 'test_secret';
  await initDb();
});

afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
});

describe('Auth API', () => {
  test('POST /api/auth/signup - creates new user', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('test@example.com');
    authToken = res.body.token;
  });

  test('POST /api/auth/signup - rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Test2', email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  test('POST /api/auth/login - authenticates user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /api/auth/login - rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me - returns current user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@example.com');
  });
});

describe('Boards API', () => {
  test('POST /api/boards - creates board', async () => {
    const res = await request(app)
      .post('/api/boards')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Test Board', description: 'Test', color: '#FF5733' });
    expect(res.status).toBe(201);
    expect(res.body.board.title).toBe('Test Board');
    boardId = res.body.board.id;
  });

  test('GET /api/boards - lists user boards', async () => {
    const res = await request(app)
      .get('/api/boards')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.boards.length).toBeGreaterThan(0);
  });

  test('GET /api/boards/:boardId - gets board details', async () => {
    const res = await request(app)
      .get(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.board.id).toBe(boardId);
  });
});

describe('Lists API', () => {
  test('POST /api/boards/:boardId/lists - creates list', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'To Do' });
    expect(res.status).toBe(201);
    expect(res.body.list.title).toBe('To Do');
    listId = res.body.list.id;
  });

  test('PUT /api/boards/:boardId/lists/:listId - updates list', async () => {
    const res = await request(app)
      .put(`/api/boards/${boardId}/lists/${listId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Backlog' });
    expect(res.status).toBe(200);
    expect(res.body.list.title).toBe('Backlog');
  });
});

describe('Tasks API', () => {
  test('POST /api/boards/:boardId/tasks - creates task', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Test Task', list_id: listId, priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.task.title).toBe('Test Task');
    taskId = res.body.task.id;
  });

  test('GET /api/boards/:boardId/tasks - lists tasks', async () => {
    const res = await request(app)
      .get(`/api/boards/${boardId}/tasks`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBeGreaterThan(0);
  });

  test('PUT /api/boards/:boardId/tasks/:taskId - updates task', async () => {
    const res = await request(app)
      .put(`/api/boards/${boardId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Updated Task', priority: 'low' });
    expect(res.status).toBe(200);
    expect(res.body.task.title).toBe('Updated Task');
  });

  test('GET /api/boards/:boardId/tasks - search tasks', async () => {
    const res = await request(app)
      .get(`/api/boards/${boardId}/tasks?search=Updated`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(1);
  });

  test('DELETE /api/boards/:boardId/tasks/:taskId - deletes task', async () => {
    const res = await request(app)
      .delete(`/api/boards/${boardId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });
});
