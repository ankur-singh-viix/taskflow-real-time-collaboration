const jwt = require('jsonwebtoken');
const { dbGet } = require('../db/database');

function initSocket(io) {
  // Auth middleware for sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await dbGet('SELECT id, name, email FROM users WHERE id = ?', [decoded.userId]);
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.user.name} (${socket.id})`);

    // Join a board room
    socket.on('join:board', async (boardId) => {
      try {
        const member = await dbGet(
          'SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ?',
          [boardId, socket.user.id]
        );
        if (!member) {
          socket.emit('error', { message: 'Not a member of this board' });
          return;
        }

        socket.join(`board:${boardId}`);
        socket.currentBoardId = boardId;

        // Notify others a user came online
        socket.to(`board:${boardId}`).emit('user:online', {
          userId: socket.user.id,
          userName: socket.user.name,
        });

        // Send current online users to the joiner
        const roomSockets = await io.in(`board:${boardId}`).fetchSockets();
        const onlineUsers = roomSockets
          .filter(s => s.id !== socket.id)
          .map(s => ({ userId: s.user.id, userName: s.user.name }));

        socket.emit('board:joined', { boardId, onlineUsers });
        console.log(`${socket.user.name} joined board:${boardId}`);
      } catch (err) {
        socket.emit('error', { message: 'Failed to join board' });
      }
    });

    // Leave board room
    socket.on('leave:board', (boardId) => {
      socket.leave(`board:${boardId}`);
      socket.to(`board:${boardId}`).emit('user:offline', {
        userId: socket.user.id,
        userName: socket.user.name,
      });
    });

    // User is typing / viewing a task (cursor presence)
    socket.on('task:viewing', ({ boardId, taskId }) => {
      socket.to(`board:${boardId}`).emit('task:viewing', {
        userId: socket.user.id,
        userName: socket.user.name,
        taskId,
      });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.user?.name}`);
      if (socket.currentBoardId) {
        socket.to(`board:${socket.currentBoardId}`).emit('user:offline', {
          userId: socket.user.id,
          userName: socket.user.name,
        });
      }
    });
  });
}

module.exports = { initSocket };
