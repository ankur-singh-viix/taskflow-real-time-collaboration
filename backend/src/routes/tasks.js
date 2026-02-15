const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, query, validationResult } = require('express-validator');
const { dbGet, dbRun, dbAll } = require('../db/database');
const { authenticate, requireBoardAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

async function getTaskWithAssignees(taskId) {
  const task = await dbGet(`
    SELECT t.*, u.name as creator_name,
           GROUP_CONCAT(DISTINCT ta.user_id) as assignee_ids,
           GROUP_CONCAT(DISTINCT us.name) as assignee_names
    FROM tasks t
    LEFT JOIN users u ON u.id = t.created_by
    LEFT JOIN task_assignees ta ON ta.task_id = t.id
    LEFT JOIN users us ON us.id = ta.user_id
    WHERE t.id = ?
    GROUP BY t.id
  `, [taskId]);
  if (task) {
    task.assignee_ids = task.assignee_ids ? task.assignee_ids.split(',') : [];
    task.assignee_names = task.assignee_names ? task.assignee_names.split(',') : [];
  }
  return task;
}

// GET /api/boards/:boardId/tasks?search=&page=&limit=
router.get('/', authenticate, requireBoardAccess, async (req, res) => {
  const { boardId } = req.params;
  const { search = '', page = 1, limit = 50, listId } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let sql = `
      SELECT t.*, u.name as creator_name,
             GROUP_CONCAT(DISTINCT ta.user_id) as assignee_ids,
             GROUP_CONCAT(DISTINCT us.name) as assignee_names
      FROM tasks t
      LEFT JOIN users u ON u.id = t.created_by
      LEFT JOIN task_assignees ta ON ta.task_id = t.id
      LEFT JOIN users us ON us.id = ta.user_id
      WHERE t.board_id = ?
    `;
    const params = [boardId];

    if (search) {
      sql += ` AND (t.title LIKE ? OR t.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (listId) {
      sql += ` AND t.list_id = ?`;
      params.push(listId);
    }

    sql += ` GROUP BY t.id ORDER BY t.position ASC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const tasks = await dbAll(sql, params);
    const parsedTasks = tasks.map(t => ({
      ...t,
      assignee_ids: t.assignee_ids ? t.assignee_ids.split(',') : [],
      assignee_names: t.assignee_names ? t.assignee_names.split(',') : [],
    }));

    res.json({ tasks: parsedTasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/boards/:boardId/tasks
router.post('/', authenticate, requireBoardAccess, [
  body('title').trim().isLength({ min: 1, max: 200 }),
  body('list_id').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { boardId } = req.params;
  const { title, description = '', list_id, priority = 'medium', due_date } = req.body;

  try {
    const list = await dbGet('SELECT * FROM lists WHERE id = ? AND board_id = ?', [list_id, boardId]);
    if (!list) return res.status(404).json({ error: 'List not found' });

    const maxPos = await dbGet('SELECT MAX(position) as maxPos FROM tasks WHERE list_id = ?', [list_id]);
    const position = (maxPos?.maxPos ?? -1) + 1;
    const taskId = uuidv4();

    await dbRun(
      'INSERT INTO tasks (id, title, description, list_id, board_id, position, priority, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [taskId, title, description, list_id, boardId, position, priority, due_date || null, req.user.id]
    );

    await dbRun(
      'INSERT INTO activity_log (id, board_id, user_id, action, entity_type, entity_id, entity_title) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), boardId, req.user.id, 'created', 'task', taskId, title]
    );

    await dbRun('UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [boardId]);
    const task = await getTaskWithAssignees(taskId);

    req.app.get('io')?.to(`board:${boardId}`).emit('task:created', { task });
    res.status(201).json({ task });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// GET /api/boards/:boardId/tasks/:taskId
router.get('/:taskId', authenticate, requireBoardAccess, async (req, res) => {
  const task = await getTaskWithAssignees(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({ task });
});

// DELETE /api/boards/:boardId/tasks/:taskId
router.delete('/:taskId', authenticate, requireBoardAccess, async (req, res) => {
  const { boardId, taskId } = req.params;
  try {
    const task = await dbGet('SELECT * FROM tasks WHERE id = ? AND board_id = ?', [taskId, boardId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await dbRun('DELETE FROM tasks WHERE id = ?', [taskId]);
    await dbRun(
      'INSERT INTO activity_log (id, board_id, user_id, action, entity_type, entity_id, entity_title) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), boardId, req.user.id, 'deleted', 'task', taskId, task.title]
    );

    req.app.get('io')?.to(`board:${boardId}`).emit('task:deleted', { taskId });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// PUT /api/boards/:boardId/tasks/move - drag-and-drop
router.put('/move', authenticate, requireBoardAccess, async (req, res) => {
  const { boardId } = req.params;
  const { taskId, fromListId, toListId, newPosition } = req.body;

  try {
    const task = await dbGet('SELECT * FROM tasks WHERE id = ? AND board_id = ?', [taskId, boardId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Shift tasks in target list to make room
    await dbRun(
      'UPDATE tasks SET position = position + 1 WHERE list_id = ? AND position >= ? AND id != ?',
      [toListId, newPosition, taskId]
    );

    await dbRun(
      'UPDATE tasks SET list_id = ?, position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [toListId, newPosition, taskId]
    );

    if (fromListId !== toListId) {
      const fromList = await dbGet('SELECT title FROM lists WHERE id = ?', [fromListId]);
      const toList = await dbGet('SELECT title FROM lists WHERE id = ?', [toListId]);
      await dbRun(
        'INSERT INTO activity_log (id, board_id, user_id, action, entity_type, entity_id, entity_title, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), boardId, req.user.id, 'moved', 'task', taskId, task.title,
          JSON.stringify({ from: fromList?.title, to: toList?.title })]
      );
    }

    const updatedTask = await getTaskWithAssignees(taskId);
    req.app.get('io')?.to(`board:${boardId}`).emit('task:moved', {
      task: updatedTask, fromListId, toListId, newPosition
    });
    res.json({ task: updatedTask });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to move task' });
  }
});

router.put('/:taskId', authenticate, requireBoardAccess, async (req, res) => {
  const { boardId, taskId } = req.params;
  const { title, description, priority, due_date } = req.body;

  try {
    const existing = await dbGet('SELECT * FROM tasks WHERE id = ? AND board_id = ?', [taskId, boardId]);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    await dbRun(`
      UPDATE tasks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        priority = COALESCE(?, priority),
        due_date = COALESCE(?, due_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title, description, priority, due_date, taskId]);

    await dbRun(
      'INSERT INTO activity_log (id, board_id, user_id, action, entity_type, entity_id, entity_title) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), boardId, req.user.id, 'updated', 'task', taskId, title || existing.title]
    );

    const task = await getTaskWithAssignees(taskId);
    req.app.get('io')?.to(`board:${boardId}`).emit('task:updated', { task });
    res.json({ task });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// POST /api/boards/:boardId/tasks/:taskId/assign
router.post('/:taskId/assign', authenticate, requireBoardAccess, async (req, res) => {
  const { boardId, taskId } = req.params;
  const { userId } = req.body;

  try {
    const member = await dbGet('SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ?', [boardId, userId]);
    if (!member) return res.status(400).json({ error: 'User is not a board member' });

    const existing = await dbGet('SELECT 1 FROM task_assignees WHERE task_id = ? AND user_id = ?', [taskId, userId]);
    if (!existing) {
      await dbRun('INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)', [taskId, userId]);
    }

    const task = await getTaskWithAssignees(taskId);
    const user = await dbGet('SELECT name FROM users WHERE id = ?', [userId]);
    await dbRun(
      'INSERT INTO activity_log (id, board_id, user_id, action, entity_type, entity_id, entity_title, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), boardId, req.user.id, 'assigned', 'task', taskId, task.title, JSON.stringify({ assignee: user?.name })]
    );

    req.app.get('io')?.to(`board:${boardId}`).emit('task:updated', { task });
    res.json({ task });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign user' });
  }
});

// DELETE /api/boards/:boardId/tasks/:taskId/assign/:userId
router.delete('/:taskId/assign/:userId', authenticate, requireBoardAccess, async (req, res) => {
  const { taskId, userId } = req.params;
  await dbRun('DELETE FROM task_assignees WHERE task_id = ? AND user_id = ?', [taskId, userId]);
  const task = await getTaskWithAssignees(taskId);
  req.app.get('io')?.to(`board:${req.params.boardId}`).emit('task:updated', { task });
  res.json({ task });
});

module.exports = router;
