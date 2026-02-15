import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TaskCard from '../task/TaskCard';
import { tasksAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function ListColumn({ list, tasks = [], boardId, members, onTaskCreated, onTaskClick, onListDeleted, onListUpdated }) {
  const [addingTask, setAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [listTitle, setListTitle] = useState(list.title);
  const [creating, setCreating] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: list.id,
    data: { type: 'list', listId: list.id },
  });

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setCreating(true);
    try {
      const { data } = await tasksAPI.create(boardId, {
        title: taskTitle,
        list_id: list.id,
        priority: 'medium',
      });
      setTaskTitle('');
      setAddingTask(false);
      toast.success('Task created');
    } catch {
      toast.error('Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const handleRenameList = async () => {
    if (!listTitle.trim() || listTitle === list.title) {
      setListTitle(list.title);
      setEditingTitle(false);
      return;
    }
    try {
      await onListUpdated(list.id, listTitle);
    } finally {
      setEditingTitle(false);
    }
  };

  return (
    <div style={{ ...styles.column, background: isOver ? '#EBF5FF' : 'var(--gray-100)' }}>
      {/* Header */}
      <div style={styles.header}>
        {editingTitle ? (
          <input
            value={listTitle}
            onChange={e => setListTitle(e.target.value)}
            onBlur={handleRenameList}
            onKeyDown={e => { if (e.key === 'Enter') handleRenameList(); if (e.key === 'Escape') { setListTitle(list.title); setEditingTitle(false); } }}
            style={styles.titleInput}
            autoFocus
          />
        ) : (
          <h3 style={styles.title} onClick={() => setEditingTitle(true)}>
            {list.title}
            <span style={styles.count}>{tasks.length}</span>
          </h3>
        )}
        <button
          className="btn btn-ghost btn-icon"
          style={{ fontSize: 16, color: 'var(--gray-400)' }}
          onClick={() => {
            if (window.confirm(`Delete list "${list.title}" and all its tasks?`)) {
              onListDeleted(list.id);
            }
          }}
          title="Delete list"
        >🗑</button>
      </div>

      {/* Tasks */}
      <div ref={setNodeRef} style={styles.taskList}>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} members={members} onClick={onTaskClick} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div style={styles.emptyDrop}>Drop tasks here</div>
        )}
      </div>

      {/* Add Task */}
      <div style={styles.addArea}>
        {addingTask ? (
          <form onSubmit={handleAddTask}>
            <textarea
              className="input"
              placeholder="Task title..."
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setAddingTask(false); setTaskTitle(''); }}}
              style={{ fontSize: 13, marginBottom: 8, resize: 'none', minHeight: 60 }}
              autoFocus
              rows={2}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                {creating ? '...' : 'Add Task'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm"
                onClick={() => { setAddingTask(false); setTaskTitle(''); }}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button className="btn btn-ghost" style={styles.addBtn} onClick={() => setAddingTask(true)}>
            + Add a task
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  column: {
    width: 280,
    flexShrink: 0,
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'calc(100vh - 140px)',
    transition: 'background 0.15s',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px 8px',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--gray-700)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  count: {
    background: 'var(--gray-300)',
    color: 'var(--gray-600)',
    borderRadius: '20px',
    padding: '0 7px',
    fontSize: 12,
    fontWeight: 600,
    minWidth: 20,
    textAlign: 'center',
  },
  titleInput: {
    fontSize: 14,
    fontWeight: 600,
    border: '1.5px solid var(--blue)',
    borderRadius: 6,
    padding: '3px 8px',
    outline: 'none',
    flex: 1,
    fontFamily: 'inherit',
  },
  taskList: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 40,
  },
  emptyDrop: {
    textAlign: 'center',
    padding: '20px 0',
    color: 'var(--gray-400)',
    fontSize: 13,
    borderRadius: 8,
    border: '2px dashed var(--gray-300)',
  },
  addArea: {
    padding: '8px 10px 12px',
  },
  addBtn: {
    width: '100%',
    justifyContent: 'flex-start',
    color: 'var(--gray-500)',
    fontSize: 13,
    padding: '6px 8px',
  },
};
