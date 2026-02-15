const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { dbGet, dbRun, dbAll } = require('../db/database');
const { authenticate, requireBoardAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// POST /api/boards/:boardId/lists
router.post('/', authenticate, requireBoardAccess, [
  body('title').trim().isLength({ min: 1, max: 100 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { boardId } = req.params;
  const { title } = req.body;

  try {
    const maxPos = await dbGet('SELECT MAX(position) as maxPos FROM lists WHERE board_id = ?', [boardId]);
    const position = (maxPos?.maxPos ?? -1) + 1;
    const listId = uuidv4();

    await dbRun(
      'INSERT INTO lists (id, title, board_id, position) VALUES (?, ?, ?, ?)',
      [listId, title, boardId, position]
    );

    const list = await dbGet('SELECT * FROM lists WHERE id = ?', [listId]);

    // Log activity
    await dbRun(
      'INSERT INTO activity_log (id, board_id, user_id, action, entity_type, entity_id, entity_title) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), boardId, req.user.id, 'created', 'list', listId, title]
    );

    req.app.get('io')?.to(`board:${boardId}`).emit('list:created', { list });
    res.status(201).json({ list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create list' });
  }
});

// PUT /api/boards/:boardId/lists/:listId
router.put('/:listId', authenticate, requireBoardAccess, async (req, res) => {
  const { boardId, listId } = req.params;
  const { title } = req.body;

  try {
    await dbRun(
      'UPDATE lists SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND board_id = ?',
      [title, listId, boardId]
    );
    const list = await dbGet('SELECT * FROM lists WHERE id = ?', [listId]);
    req.app.get('io')?.to(`board:${boardId}`).emit('list:updated', { list });
    res.json({ list });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update list' });
  }
});

// DELETE /api/boards/:boardId/lists/:listId
router.delete('/:listId', authenticate, requireBoardAccess, async (req, res) => {
  const { boardId, listId } = req.params;
  try {
    const list = await dbGet('SELECT * FROM lists WHERE id = ? AND board_id = ?', [listId, boardId]);
    if (!list) return res.status(404).json({ error: 'List not found' });

    await dbRun('DELETE FROM lists WHERE id = ?', [listId]);
    req.app.get('io')?.to(`board:${boardId}`).emit('list:deleted', { listId });
    res.json({ message: 'List deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete list' });
  }
});

// PUT /api/boards/:boardId/lists/reorder - reorder lists
router.put('/reorder', authenticate, requireBoardAccess, async (req, res) => {
  const { boardId } = req.params;
  const { lists } = req.body; // [{id, position}]

  try {
    for (const item of lists) {
      await dbRun('UPDATE lists SET position = ? WHERE id = ? AND board_id = ?', [item.position, item.id, boardId]);
    }
    req.app.get('io')?.to(`board:${boardId}`).emit('lists:reordered', { lists });
    res.json({ message: 'Lists reordered' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder lists' });
  }
});

module.exports = router;
