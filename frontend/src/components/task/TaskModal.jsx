import React, { useState, useEffect } from 'react';
import { tasksAPI } from '../../services/api';
import { useBoardStore } from '../../store';
import toast from 'react-hot-toast';

const AVATAR_COLORS = ['#0052CC','#00875A','#6554C0','#DE350B','#FF8B00','#00B8D9'];
const getAvatarColor = (name) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

export default function TaskModal({ task, boardId, members, onClose, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: task.title, description: task.description || '', priority: task.priority, due_date: task.due_date || '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const { data } = await tasksAPI.update(boardId, task.id, form);
      onUpdated(data.task);
      toast.success('Task updated');
      setEditing(false);
    } catch {
      toast.error('Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this task?')) return;
    setDeleting(true);
    try {
      await tasksAPI.delete(boardId, task.id);
      onDeleted(task.id);
      toast.success('Task deleted');
      onClose();
    } catch {
      toast.error('Failed to delete task');
    } finally {
      setDeleting(false);
    }
  };

  const handleAssign = async (userId) => {
    const isAssigned = task.assignee_ids?.includes(userId);
    try {
      if (isAssigned) {
        const { data } = await tasksAPI.unassign(boardId, task.id, userId);
        onUpdated(data.task);
      } else {
        const { data } = await tasksAPI.assign(boardId, task.id, userId);
        onUpdated(data.task);
      }
    } catch {
      toast.error('Failed to update assignment');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ flex: 1 }}>
            {editing ? (
              <input className="input" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                style={{ fontSize: 17, fontWeight: 600, padding: '4px 8px' }}
                autoFocus />
            ) : (
              <h2 style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{task.title}</h2>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
            {!editing && (
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>✏️ Edit</button>
            )}
            <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 24 }}>
          {/* Main */}
          <div>
            <div className="form-group">
              <label className="form-label">Description</label>
              {editing ? (
                <textarea className="input" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Add a description..." rows={4} />
              ) : (
                <p style={{ fontSize: 14, color: task.description ? 'var(--gray-700)' : 'var(--gray-400)', lineHeight: 1.6 }}>
                  {task.description || 'No description'}
                </p>
              )}
            </div>

            {editing && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="input" value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input className="input" type="date" value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>
            )}

            {!editing && (
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                <div>
                  <p className="form-label">Priority</p>
                  <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                </div>
                {task.due_date && (
                  <div>
                    <p className="form-label">Due Date</p>
                    <span style={{ fontSize: 13 }}>📅 {task.due_date}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <div className="form-group">
              <label className="form-label">👥 Assignees</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {members.map(m => {
                  const isAssigned = task.assignee_ids?.includes(m.id);
                  return (
                    <button key={m.id} onClick={() => handleAssign(m.id)}
                      style={{ ...styles.memberRow, background: isAssigned ? 'var(--blue-light)' : 'var(--gray-50)' }}>
                      <div className="avatar" style={{ width: 28, height: 28, fontSize: 11, background: getAvatarColor(m.name) }}>
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 13, flex: 1, textAlign: 'left' }}>{m.name}</span>
                      {isAssigned && <span style={{ color: 'var(--blue)', fontSize: 16 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="form-label">📝 Created by</label>
              <p style={{ fontSize: 13, color: 'var(--gray-600)' }}>{task.creator_name}</p>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? '...' : '🗑️ Delete'}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            {editing ? (
              <>
                <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <span className="spinner" /> : 'Save Changes'}
                </button>
              </>
            ) : (
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
};
