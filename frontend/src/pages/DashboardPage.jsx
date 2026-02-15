import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useBoardStore } from '../store';
import { boardsAPI } from '../services/api';
import toast from 'react-hot-toast';

const COLORS = ['#0052CC','#00875A','#DE350B','#FF8B00','#6554C0','#00B8D9','#36B37E','#FF5630'];

function BoardCard({ board, onClick, onDelete }) {
  const initial = board.title.charAt(0).toUpperCase();

  return (
    <div
      style={{ ...styles.boardCard, borderTop: `4px solid ${board.color}` }}
      onClick={onClick}
      className="card"
    >
      {/* DELETE BUTTON (Admin Only) */}
      {board.my_role === 'admin' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Delete this board permanently?')) {
              onDelete(board.id);
            }
          }}
          style={styles.deleteBtn}
        >
          🗑
        </button>
      )}

      <div style={styles.boardIcon(board.color)}>{initial}</div>

      <div style={styles.boardInfo}>
        <h3 style={styles.boardTitle}>{board.title}</h3>

        {board.description && (
          <p style={styles.boardDesc}>{board.description}</p>
        )}

        <div style={styles.boardMeta}>
          <span>📋 {board.list_count} lists</span>
          <span>✅ {board.task_count} tasks</span>
          <span style={styles.roleTag}>{board.my_role}</span>
        </div>
      </div>
    </div>
  );
}

function CreateBoardModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', color: COLORS[0] });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setLoading(true);
    try {
      const { data } = await boardsAPI.create(form);
      onCreated(data.board);
      toast.success('Board created!');
      onClose();
    } catch {
      toast.error('Failed to create board');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Board</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Board Name *</label>
              <input
                className="input"
                placeholder="e.g. Product Roadmap"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="input"
                placeholder="What's this board about?"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Color</label>
              <div style={styles.colorGrid}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    style={{
                      ...styles.colorDot,
                      background: c,
                      outline: form.color === c ? `3px solid ${c}` : 'none',
                      outlineOffset: 2,
                    }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create Board'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const { boards, setBoards } = useBoardStore();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    boardsAPI
      .list()
      .then(({ data }) => {
        setBoards(data.boards);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [setBoards]);

  const handleDeleteBoard = async (boardId) => {
    try {
      await boardsAPI.delete(boardId);
      setBoards(boards.filter((b) => b.id !== boardId));
      toast.success('Board deleted');
    } catch {
      toast.error('Failed to delete board');
    }
  };

  const filtered = boards.filter((b) =>
    b.title.toLowerCase().includes(search.toLowerCase())
  );

  const avatarColor =
    ['#0052CC','#00875A','#6554C0','#DE350B','#FF8B00'][
      user?.name?.charCodeAt(0) % 5
    ];

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>⚡</span>
            <span style={styles.logo}>TaskFlow</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="avatar" style={{ background: avatarColor }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{user?.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.toolbar}>
          <div>
            <h1 style={styles.heading}>My Boards</h1>
            <p style={styles.subheading}>
              Manage and collaborate on your projects
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              className="input"
              placeholder="🔍 Search boards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
            />

            <button
              className="btn btn-primary"
              onClick={() => setShowCreate(true)}
            >
              + New Board
            </button>
          </div>
        </div>

        {loading ? (
          <div style={styles.empty}>Loading boards...</div>
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              No boards yet
            </h3>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreate(true)}
            >
              Create Board
            </button>
          </div>
        ) : (
          <div style={styles.grid}>
            {filtered.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                onClick={() => navigate(`/board/${board.id}`)}
                onDelete={handleDeleteBoard}
              />
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateBoardModal
          onClose={() => setShowCreate(false)}
          onCreated={(b) => setBoards([b, ...boards])}
        />
      )}
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'var(--gray-50)' },
  header: { background: 'white', borderBottom: '1px solid var(--gray-200)', position: 'sticky', top: 0, zIndex: 100 },
  headerInner: { maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo: { fontSize: 20, fontWeight: 700, color: 'var(--gray-900)' },
  main: { maxWidth: 1200, margin: '0 auto', padding: '32px 24px' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 },
  heading: { fontSize: 26, fontWeight: 700 },
  subheading: { color: 'var(--gray-500)', fontSize: 14, marginTop: 4 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 },

  boardCard: {
    padding: 20,
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start',
    position: 'relative'
  },

  deleteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16
  },

  boardIcon: (color) => ({
    width: 44,
    height: 44,
    borderRadius: 10,
    background: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    color: 'white',
    flexShrink: 0,
  }),

  boardInfo: { flex: 1, minWidth: 0 },
  boardTitle: { fontSize: 15, fontWeight: 600, marginBottom: 4 },
  boardDesc: { fontSize: 13, color: 'var(--gray-500)', marginBottom: 10 },
  boardMeta: { display: 'flex', gap: 10, fontSize: 12, color: 'var(--gray-500)', alignItems: 'center' },
  roleTag: { background: 'var(--blue-light)', color: 'var(--blue)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'capitalize' },
  colorGrid: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  colorDot: { width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', border: 'none' },
  empty: { textAlign: 'center', padding: '80px 0', color: 'var(--gray-500)' },
};