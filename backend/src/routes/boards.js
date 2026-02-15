const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, query, validationResult } = require('express-validator');
const { dbGet, dbRun, dbAll } = require('../db/database');
const { authenticate, requireBoardAccess } = require('../middleware/auth');

const router = express.Router();

// GET /api/boards - list boards for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const boards = await dbAll(`
      SELECT b.*, u.name as owner_name,
             (SELECT COUNT(*) FROM lists WHERE board_id = b.id) as list_count,
             (SELECT COUNT(*) FROM tasks WHERE board_id = b.id) as task_count,
             bm.role as my_role
      FROM boards b
      JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = ?
      JOIN users u ON u.id = b.owner_id
      ORDER BY b.updated_at DESC
    `, [req.user.id]);
    res.json({ boards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// POST /api/boards - create board
router.post('/', authenticate, [
  body('title').trim().isLength({ min: 1, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, description = '', color = '#0052CC' } = req.body;
  const boardId = uuidv4();

  try {
    await dbRun(
      'INSERT INTO boards (id, title, description, color, owner_id) VALUES (?, ?, ?, ?, ?)',
      [boardId, title, description, color, req.user.id]
    );
    await dbRun(
      'INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)',
      [boardId, req.user.id, 'admin']
    );

    const board = await dbGet('SELECT * FROM boards WHERE id = ?', [boardId]);
    res.status(201).json({ board: { ...board, my_role: 'admin' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create board' });
  }
});

// GET /api/boards/:boardId - get board details with lists and tasks
router.get('/:boardId', authenticate, requireBoardAccess, async (req, res) => {
  const { boardId } = req.params;
  try {
    const board = await dbGet(`
      SELECT b.*, u.name as owner_name, bm.role as my_role
      FROM boards b
      JOIN users u ON u.id = b.owner_id
      JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = ?
      WHERE b.id = ?
    `, [req.user.id, boardId]);

    if (!board) return res.status(404).json({ error: 'Board not found' });

    const lists = await dbAll(
      'SELECT * FROM lists WHERE board_id = ? ORDER BY position ASC',
      [boardId]
    );

    const tasks = await dbAll(`
      SELECT t.*, u.name as creator_name,
             GROUP_CONCAT(DISTINCT ta.user_id) as assignee_ids,
             GROUP_CONCAT(DISTINCT us.name) as assignee_names
      FROM tasks t
      LEFT JOIN users u ON u.id = t.created_by
      LEFT JOIN task_assignees ta ON ta.task_id = t.id
      LEFT JOIN users us ON us.id = ta.user_id
      WHERE t.board_id = ?
      GROUP BY t.id
      ORDER BY t.position ASC
    `, [boardId]);

    const members = await dbAll(`
      SELECT u.id, u.name, u.email, u.avatar, bm.role, bm.joined_at
      FROM board_members bm
      JOIN users u ON u.id = bm.user_id
      WHERE bm.board_id = ?
    `, [boardId]);

    // Parse tasks
    const parsedTasks = tasks.map(t => ({
      ...t,
      assignee_ids: t.assignee_ids ? t.assignee_ids.split(',') : [],
      assignee_names: t.assignee_names ? t.assignee_names.split(',') : [],
    }));

    res.json({ board, lists, tasks: parsedTasks, members });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch board' });
  }
});

// PUT /api/boards/:boardId - update board
router.put('/:boardId', authenticate, requireBoardAccess, [
  body('title').optional().trim().isLength({ min: 1, max: 100 }),
], async (req, res) => {
  const { boardId } = req.params;
  const { title, description, color } = req.body;
  try {
    await dbRun(
      'UPDATE boards SET title = COALESCE(?, title), description = COALESCE(?, description), color = COALESCE(?, color), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, description, color, boardId]
    );
    const board = await dbGet('SELECT * FROM boards WHERE id = ?', [boardId]);
    res.json({ board });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update board' });
  }
});

// DELETE /api/boards/:boardId
router.delete('/:boardId', authenticate, requireBoardAccess, async (req, res) => {
  const { boardId } = req.params;
  if (req.boardRole !== 'admin') return res.status(403).json({ error: 'Only admins can delete boards' });
  try {
    await dbRun('DELETE FROM boards WHERE id = ?', [boardId]);
    res.json({ message: 'Board deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete board' });
  }
});

// POST /api/boards/:boardId/members - invite member
router.post('/:boardId/members', authenticate, requireBoardAccess, async (req, res) => {
  const { boardId } = req.params;
  const { email } = req.body;
  if (req.boardRole !== 'admin') return res.status(403).json({ error: 'Only admins can invite members' });
  try {
    const user = await dbGet('SELECT id, name, email FROM users WHERE email = ?', [email]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existing = await dbGet('SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ?', [boardId, user.id]);
    if (existing) return res.status(409).json({ error: 'User already a member' });

    await dbRun('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)', [boardId, user.id, 'member']);
    res.json({ member: { ...user, role: 'member' } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// GET /api/boards/:boardId/activity
router.get('/:boardId/activity', authenticate, requireBoardAccess, async (req, res) => {
  const { boardId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  try {
    const activities = await dbAll(`
      SELECT al.*, u.name as user_name
      FROM activity_log al
      JOIN users u ON u.id = al.user_id
      WHERE al.board_id = ?
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [boardId, limit, offset]);

    const total = await dbGet('SELECT COUNT(*) as count FROM activity_log WHERE board_id = ?', [boardId]);
    res.json({ activities, pagination: { page, limit, total: total.count } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

module.exports = router;
