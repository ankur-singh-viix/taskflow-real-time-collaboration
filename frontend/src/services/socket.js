import { io } from 'socket.io-client';

const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:5000';

let socket = null;

export function connectSocket(token) {
  // 🔒 Prevent connection without token
  if (!token) {
    console.warn(' Socket not connected: No token provided');
    return null;
  }

  // 🔁 Prevent duplicate connections
  if (socket && socket.connected) {
    return socket;
  }

  // 🧹 Clean old socket if exists
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'], // Best for production
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log(' Socket connected:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error(' Socket connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log(' Socket disconnected:', reason);
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinBoard(boardId) {
  if (socket?.connected) {
    socket.emit('join:board', boardId);
  }
}

export function leaveBoard(boardId) {
  if (socket?.connected) {
    socket.emit('leave:board', boardId);
  }
}