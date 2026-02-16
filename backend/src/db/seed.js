const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { initDb, dbRun, dbGet, dbAll } = require('./database');
require('dotenv').config();

async function seed() {
  await initDb();
  console.log('Seeding database...');

  // Clear existing data
  await dbRun('DELETE FROM activity_log');
  await dbRun('DELETE FROM task_assignees');
  await dbRun('DELETE FROM tasks');
  await dbRun('DELETE FROM lists');
  await dbRun('DELETE FROM board_members');
  await dbRun('DELETE FROM boards');
  await dbRun('DELETE FROM users');

  // Create users
  const password = await bcrypt.hash('password123', 10);

  const alice = { id: uuidv4(), name: 'Alice Johnson', email: 'alice@taskflow.com' };
  const bob = { id: uuidv4(), name: 'Bob Smith', email: 'bob@taskflow.com' };
  const carol = { id: uuidv4(), name: 'Carol Davis', email: 'carol@taskflow.com' };
  const ankur = { id: uuidv4(), name: 'Ankur Singh', email: 'ankur@taskflow.com' };


  for (const user of [alice, bob, carol ,ankur]) {
    await dbRun(
      'INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)',
      [user.id, user.name, user.email, password]
    );
  }

  // Create a board
  const boardId = uuidv4();
  await dbRun(
    'INSERT INTO boards (id, title, description, color, owner_id) VALUES (?, ?, ?, ?, ?)',
    [boardId, 'Product Roadmap', 'Main product planning board', '#0052CC', alice.id]
  );

  // Add members
  for (const userId of [alice.id, bob.id, carol.id ,ankur.id]) {
    const role = userId === alice.id ? 'admin' : 'member';
    await dbRun(
      'INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)',
      [boardId, userId, role]
    );
  }

  // Create lists
  const listData = [
    { id: uuidv4(), title: 'Backlog', position: 0 },
    { id: uuidv4(), title: 'In Progress', position: 1 },
    { id: uuidv4(), title: 'Review', position: 2 },
    { id: uuidv4(), title: 'Done', position: 3 },
  ];

  for (const list of listData) {
    await dbRun(
      'INSERT INTO lists (id, title, board_id, position) VALUES (?, ?, ?, ?)',
      [list.id, list.title, boardId, list.position]
    );
  }

  // Create tasks
  const tasks = [
    { title: 'Design new landing page', description: 'Create wireframes and mockups for the new landing page', listIndex: 0, priority: 'high', assignees: [alice.id] },
    { title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated testing and deployment', listIndex: 0, priority: 'medium', assignees: [bob.id] },
    { title: 'Implement user authentication', description: 'JWT-based auth with refresh tokens', listIndex: 1, priority: 'high', assignees: [bob.id, alice.id] },
    { title: 'Write API documentation', description: 'Document all REST endpoints using OpenAPI spec', listIndex: 1, priority: 'low', assignees: [carol.id] },
    { title: 'Database optimization', description: 'Add missing indexes and optimize slow queries', listIndex: 2, priority: 'medium', assignees: [bob.id] },
    { title: 'User onboarding flow', description: 'Complete the onboarding email sequence', listIndex: 3, priority: 'low', assignees: [carol.id] },
  ];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskId = uuidv4();
    const list = listData[task.listIndex];
    await dbRun(
      'INSERT INTO tasks (id, title, description, list_id, board_id, position, priority, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [taskId, task.title, task.description, list.id, boardId, i, task.priority, alice.id]
    );
    for (const userId of task.assignees) {
      await dbRun(
        'INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)',
        [taskId, userId]
      );
    }

    await dbRun(
      'INSERT INTO activity_log (id, board_id, user_id, action, entity_type, entity_id, entity_title) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), boardId, alice.id, 'created', 'task', taskId, task.title]
    );
  }

  console.log('\n Database seeded successfully!');
  console.log('\n Demo Credentials:');
  console.log('  Email: alice@taskflow.com | Password: password123');
  console.log('  Email: bob@taskflow.com   | Password: password123');
  console.log('  Email: carol@taskflow.com | Password: password123');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
