import { create } from 'zustand';
import { authAPI } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

// Auth Store
export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || null,
  isLoading: false,

  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const { data } = await authAPI.login(credentials);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      connectSocket(data.token);
      set({ user: data.user, token: data.token, isLoading: false });
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    }
  },

  signup: async (userData) => {
    set({ isLoading: true });
    try {
      const { data } = await authAPI.signup(userData);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      connectSocket(data.token);
      set({ user: data.user, token: data.token, isLoading: false });
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      const errors = err.response?.data?.errors;
      return { success: false, error: errors?.[0]?.msg || err.response?.data?.error || 'Signup failed' };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectSocket();
    set({ user: null, token: null });
  },

  initSocket: () => {
    const token = get().token;
    if (token) connectSocket(token);
  },
}));

// Board Store
export const useBoardStore = create((set, get) => ({
  boards: [],
  currentBoard: null,
  lists: [],
  tasks: {},      // { [listId]: Task[] }
  members: [],
  onlineUsers: [],
  isLoading: false,

  setBoards: (boards) => set({ boards }),

  setCurrentBoard: (board, lists, tasks, members) => {
    const tasksByList = {};
    lists.forEach(l => { tasksByList[l.id] = []; });
    tasks.forEach(t => {
      if (!tasksByList[t.list_id]) tasksByList[t.list_id] = [];
      tasksByList[t.list_id].push(t);
    });
    // Sort by position
    Object.keys(tasksByList).forEach(lid => {
      tasksByList[lid].sort((a, b) => a.position - b.position);
    });
    set({ currentBoard: board, lists, tasks: tasksByList, members });
  },

  clearBoard: () => set({ currentBoard: null, lists: [], tasks: {}, members: [], onlineUsers: [] }),

  // Real-time handlers
  handleListCreated: (list) => set(state => ({
    lists: [...state.lists, list],
    tasks: { ...state.tasks, [list.id]: [] },
  })),

  handleListUpdated: (list) => set(state => ({
    lists: state.lists.map(l => l.id === list.id ? list : l),
  })),

  handleListDeleted: (listId) => set(state => {
    const { [listId]: _, ...remaining } = state.tasks;
    return { lists: state.lists.filter(l => l.id !== listId), tasks: remaining };
  }),

  handleTaskCreated: (task) => set(state => ({
    tasks: {
      ...state.tasks,
      [task.list_id]: [...(state.tasks[task.list_id] || []), task],
    },
  })),

  handleTaskUpdated: (task) => set(state => {
    const newTasks = { ...state.tasks };
    Object.keys(newTasks).forEach(lid => {
      newTasks[lid] = newTasks[lid].filter(t => t.id !== task.id);
    });
    newTasks[task.list_id] = [...(newTasks[task.list_id] || []), task].sort((a, b) => a.position - b.position);
    return { tasks: newTasks };
  }),

  handleTaskDeleted: (taskId) => set(state => {
    const newTasks = { ...state.tasks };
    Object.keys(newTasks).forEach(lid => {
      newTasks[lid] = newTasks[lid].filter(t => t.id !== taskId);
    });
    return { tasks: newTasks };
  }),

  handleTaskMoved: ({ task, fromListId, toListId }) => {
    const state = get();
    const newTasks = { ...state.tasks };
    Object.keys(newTasks).forEach(lid => {
      newTasks[lid] = newTasks[lid].filter(t => t.id !== task.id);
    });
    newTasks[toListId] = [...(newTasks[toListId] || []), task].sort((a, b) => a.position - b.position);
    set({ tasks: newTasks });
  },

  // Local optimistic updates for drag-drop
  moveTaskLocally: (taskId, fromListId, toListId, newIndex) => set(state => {
    const newTasks = { ...state.tasks };
    const fromList = [...(newTasks[fromListId] || [])];
    const taskIndex = fromList.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return state;

    const [task] = fromList.splice(taskIndex, 1);
    const toList = fromListId === toListId ? fromList : [...(newTasks[toListId] || [])];
    toList.splice(newIndex, 0, { ...task, list_id: toListId });

    if (fromListId === toListId) {
      newTasks[fromListId] = toList;
    } else {
      newTasks[fromListId] = fromList;
      newTasks[toListId] = toList;
    }
    return { tasks: newTasks };
  }),

  setOnlineUsers: (users) => set({ onlineUsers: users }),
  addOnlineUser: (user) => set(state => ({
    onlineUsers: [...state.onlineUsers.filter(u => u.userId !== user.userId), user],
  })),
  removeOnlineUser: (userId) => set(state => ({
    onlineUsers: state.onlineUsers.filter(u => u.userId !== userId),
  })),
}));
