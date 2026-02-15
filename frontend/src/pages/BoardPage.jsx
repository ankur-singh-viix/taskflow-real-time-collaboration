import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, MouseSensor, TouchSensor,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { boardsAPI, listsAPI, tasksAPI } from '../services/api';
import { getSocket, joinBoard, leaveBoard } from '../services/socket';
import { useAuthStore, useBoardStore } from '../store';
import ListColumn from '../components/board/ListColumn';
import TaskCard from '../components/task/TaskCard';
import TaskModal from '../components/task/TaskModal';
import ActivitySidebar from '../components/board/ActivitySidebar';
import toast from 'react-hot-toast';

const AVATAR_COLORS = ['#0052CC','#00875A','#6554C0','#DE350B','#FF8B00'];
const getAvatarColor = (name) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

export default function BoardPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentBoard, lists, tasks, members, onlineUsers,
    setCurrentBoard, clearBoard,
    handleListCreated, handleListUpdated, handleListDeleted,
    handleTaskCreated, handleTaskUpdated, handleTaskDeleted, handleTaskMoved,
    moveTaskLocally, setOnlineUsers, addOnlineUser, removeOnlineUser,
  } = useBoardStore();

  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showActivity, setShowActivity] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showAddList, setShowAddList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // Load board data
  useEffect(() => {
    boardsAPI.get(boardId).then(({ data }) => {
      setCurrentBoard(data.board, data.lists, data.tasks, data.members);
      setLoading(false);
    }).catch(err => {
      toast.error('Board not found');
      navigate('/dashboard');
    });
    return () => clearBoard();
  }, [boardId]);

  // Socket setup
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    joinBoard(boardId);

    socket.on('board:joined', ({ onlineUsers: users }) => setOnlineUsers(users));
    socket.on('user:online', (u) => { addOnlineUser(u); toast(`${u.userName} joined the board`, { icon: '👋', duration: 2000 }); });
    socket.on('user:offline', ({ userId, userName }) => { removeOnlineUser(userId); });
    socket.on('list:created', ({ list }) => handleListCreated(list));
    socket.on('list:updated', ({ list }) => handleListUpdated(list));
    socket.on('list:deletexd', ({ listId }) => handleListDeleted(listId));
    socket.on('task:created', ({ task }) => handleTaskCreated(task));
    socket.on('task:updated', ({ task }) => handleTaskUpdated(task));
    socket.on('task:deleted', ({ taskId }) => handleTaskDeleted(taskId));
    socket.on('task:moved', (data) => handleTaskMoved(data));

    return () => {
      leaveBoard(boardId);
      ['board:joined','user:online','user:offline','list:created','list:updated','list:deleted','task:created','task:updated','task:deleted','task:moved'].forEach(e => socket.off(e));
    };
  }, [boardId]);

  // Drag handlers
  const handleDragStart = useCallback(({ active }) => {
    const task = Object.values(tasks).flat().find(t => t.id === active.id);
    if (task) setActiveTask(task);
  }, [tasks]);

  const handleDragEnd = useCallback(async ({ active, over }) => {
    setActiveTask(null);
    if (!over || active.id === over.id) return;

    const sourceTask = Object.values(tasks).flat().find(t => t.id === active.id);
    if (!sourceTask) return;

    const fromListId = sourceTask.list_id;
    let toListId = over.data?.current?.listId || over.id;
    let toIndex = 0;

    // If dropped on a task, get its position
    if (over.data?.current?.type === 'task') {
      const overTask = over.data.current.task;
      toListId = overTask.list_id;
      toIndex = tasks[toListId]?.findIndex(t => t.id === overTask.id) ?? 0;
    } else {
      toIndex = tasks[toListId]?.length ?? 0;
    }

    moveTaskLocally(sourceTask.id, fromListId, toListId, toIndex);

    try {
      await tasksAPI.move(boardId, {
        taskId: sourceTask.id,
        fromListId,
        toListId,
        newPosition: toIndex,
      });
    } catch {
      toast.error('Failed to move task');
    }
  }, [tasks, boardId, moveTaskLocally]);

  const handleAddList = async (e) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    try {
      const { data } = await listsAPI.create(boardId, { title: newListTitle });
      setNewListTitle('');
      setShowAddList(false);
      toast.success('List created');
    } catch {
      toast.error('Failed to create list');
    }
  };

  const handleDeleteList = async (listId) => {
    try {
      await listsAPI.delete(boardId, listId);
      handleListDeleted(listId);
      toast.success('List deleted');
    } catch {
      toast.error('Failed to delete list');
    }
  };

  const handleUpdateList = async (listId, title) => {
    try {
      const { data } = await listsAPI.update(boardId, listId, { title });
      handleListUpdated(data.list);
    } catch {
      toast.error('Failed to rename list');
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      await boardsAPI.addMember(boardId, inviteEmail);
      toast.success('Member added!');
      setInviteEmail('');
      setShowInvite(false);
      // Reload members
      const { data } = await boardsAPI.get(boardId);
      setCurrentBoard(data.board, data.lists, data.tasks, data.members);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add member');
    }
  };

  const filteredTasks = (listId) => {
    const listTasks = tasks[listId] || [];
    if (!searchQuery) return listTasks;
    return listTasks.filter(t =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--gray-200)', borderTop: '3px solid var(--blue)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
        <p style={{ color: 'var(--gray-500)' }}>Loading board...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')} style={{ color: 'white' }}>← Back</button>
          <h1 style={styles.boardTitle}>{currentBoard?.title}</h1>
        </div>

        <div style={styles.headerRight}>
          {/* Search */}
          <input className="input" placeholder="🔍 Search tasks..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ width: 200, height: 34, fontSize: 13 }} />

          {/* Online users */}
          <div style={styles.onlineUsers}>
            {onlineUsers.map(u => (
              <div key={u.userId} title={`${u.userName} is online`}
                className="avatar" style={{ width: 28, height: 28, fontSize: 11, background: getAvatarColor(u.userName), border: '2px solid #00875A', marginLeft: -6 }}>
                {u.userName.charAt(0).toUpperCase()}
              </div>
            ))}
            <div className="avatar" style={{ width: 28, height: 28, fontSize: 11, background: getAvatarColor(user?.name), border: '2px solid white', marginLeft: -6 }} title="You (online)">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>

          {/* Members */}
          {members.slice(0, 3).map((m, i) => (
            <div key={m.id} className="avatar" title={m.name}
              style={{ width: 28, height: 28, fontSize: 11, background: getAvatarColor(m.name), marginLeft: i > 0 ? -6 : 0, border: '2px solid white' }}>
              {m.name.charAt(0).toUpperCase()}
            </div>
          ))}

          <button className="btn btn-ghost btn-sm" style={{ color: 'white' }} onClick={() => setShowInvite(true)}>+ Invite</button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'white' }} onClick={() => setShowActivity(a => !a)}>
            📜 Activity
          </button>
        </div>
      </header>

      {/* Board */}
      <div style={styles.boardArea}>
        <DndContext sensors={sensors} collisionDetection={closestCorners}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={styles.lists}>
            {lists.map(list => (
              <ListColumn
                key={list.id}
                list={list}
                tasks={filteredTasks(list.id)}
                boardId={boardId}
                members={members}
                onTaskCreated={handleTaskCreated}
                onTaskClick={(task) => setSelectedTask(task)}
                onListDeleted={handleDeleteList}
                onListUpdated={handleUpdateList}
              />
            ))}

            {/* Add List */}
            <div style={styles.addListWrap}>
              {showAddList ? (
                <form onSubmit={handleAddList} style={styles.addListForm}>
                  <input className="input" placeholder="List name..."
                    value={newListTitle} onChange={e => setNewListTitle(e.target.value)}
                    autoFocus style={{ marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="submit" className="btn btn-primary btn-sm">Add</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddList(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <button className="btn" style={styles.addListBtn} onClick={() => setShowAddList(true)}>
                  + Add List
                </button>
              )}
            </div>
          </div>

          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} isDragOverlay onClick={() => {}} /> : null}
          </DragOverlay>
        </DndContext>

        {/* Activity Sidebar */}
        {showActivity && <ActivitySidebar boardId={boardId} onClose={() => setShowActivity(false)} />}
      </div>

      {/* Task Modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          boardId={boardId}
          members={members}
          onClose={() => setSelectedTask(null)}
          onUpdated={(t) => { handleTaskUpdated(t); setSelectedTask(t); }}
          onDeleted={(id) => { handleTaskDeleted(id); setSelectedTask(null); }}
        />
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Invite Member</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowInvite(false)}>✕</button>
            </div>
            <form onSubmit={handleInvite}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input className="input" type="email" placeholder="colleague@company.com"
                    value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required autoFocus />
                </div>
                <p style={{ fontSize: 12, color: 'var(--gray-500)' }}>The user must already have a TaskFlow account.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowInvite(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Send Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--gray-100)' },
  header: {
    background: 'linear-gradient(135deg, #0052CC, #0041a3)',
    padding: '0 20px',
    height: 58,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  boardTitle: { color: 'white', fontSize: 17, fontWeight: 700 },
  onlineUsers: { display: 'flex', alignItems: 'center', marginRight: 4 },
  boardArea: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  lists: {
    flex: 1,
    display: 'flex',
    gap: 14,
    padding: '16px 20px',
    overflowX: 'auto',
    alignItems: 'flex-start',
  },
  addListWrap: { flexShrink: 0, width: 280 },
  addListForm: {
    background: 'var(--gray-100)',
    borderRadius: 12,
    padding: 12,
  },
  addListBtn: {
    background: 'rgba(255,255,255,0.5)',
    color: 'var(--gray-600)',
    width: '100%',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
    backdropFilter: 'blur(4px)',
  },
};
