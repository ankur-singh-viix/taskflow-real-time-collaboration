const jwt = require('jsonwebtoken');
const { dbGet } = require('../db/database');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await dbGet('SELECT id, name, email, avatar FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function requireBoardAccess(req, res, next) {
  const boardId = req.params.boardId || req.body.boardId;
  if (!boardId) return next();

  const member = await dbGet(
    'SELECT role FROM board_members WHERE board_id = ? AND user_id = ?',
    [boardId, req.user.id]
  );
  if (!member) {
    return res.status(403).json({ error: 'Access denied to this board' });
  }
  req.boardRole = member.role;
  next();
}

module.exports = { authenticate, requireBoardAccess };
