import React, { useEffect, useState } from 'react';
import { boardsAPI } from '../../services/api';

const ACTION_ICONS = {
  created: '✅',
  updated: '✏️',
  deleted: '🗑️',
  moved: '↕️',
  assigned: '👤',
};

const AVATAR_COLORS = ['#0052CC','#00875A','#6554C0','#DE350B','#FF8B00'];
const getAvatarColor = (name) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ActivitySidebar({ boardId, onClose }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = async (p = 1) => {
    try {
      const { data } = await boardsAPI.getActivity(boardId, p);
      if (p === 1) {
        setActivities(data.activities);
      } else {
        setActivities(prev => [...prev, ...data.activities]);
      }
      setHasMore(data.activities.length === 20);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [boardId]);

  return (
    <div style={styles.sidebar}>
      <div style={styles.header}>
        <h3 style={styles.title}>📜 Activity</h3>
        <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
      </div>

      <div style={styles.list}>
        {loading ? (
          <div style={styles.empty}>Loading...</div>
        ) : activities.length === 0 ? (
          <div style={styles.empty}>No activity yet</div>
        ) : (
          activities.map(a => (
            <div key={a.id} style={styles.item}>
              <div className="avatar" style={{ width: 28, height: 28, fontSize: 11, background: getAvatarColor(a.user_name), flexShrink: 0 }}>
                {a.user_name?.charAt(0)?.toUpperCase()}
              </div>
              <div style={styles.content}>
                <p style={styles.text}>
                  <span style={styles.name}>{a.user_name}</span>
                  {' '}{ACTION_ICONS[a.action] || '•'}{' '}
                  {a.action} <span style={styles.entityType}>{a.entity_type}</span>{' '}
                  <span style={styles.entityTitle}>"{a.entity_title}"</span>
                  {a.metadata && a.metadata !== '{}' && (() => {
                    try {
                      const meta = JSON.parse(a.metadata);
                      if (meta.from && meta.to) return <span style={{ color: 'var(--gray-500)' }}> from "{meta.from}" to "{meta.to}"</span>;
                      if (meta.assignee) return <span style={{ color: 'var(--gray-500)' }}> to {meta.assignee}</span>;
                    } catch { return null; }
                    return null;
                  })()}
                </p>
                <span style={styles.time}>{timeAgo(a.created_at)}</span>
              </div>
            </div>
          ))
        )}

        {hasMore && (
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            onClick={() => { setPage(p => p + 1); load(page + 1); }}>
            Load more
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    width: 300,
    background: 'white',
    borderLeft: '1px solid var(--gray-200)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--gray-200)',
  },
  title: { fontSize: 15, fontWeight: 600 },
  list: { flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 },
  item: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  content: { flex: 1 },
  text: { fontSize: 12.5, color: 'var(--gray-700)', lineHeight: 1.5 },
  name: { fontWeight: 600 },
  entityType: { color: 'var(--gray-500)' },
  entityTitle: { fontWeight: 500 },
  time: { fontSize: 11, color: 'var(--gray-400)', marginTop: 2, display: 'block' },
  empty: { textAlign: 'center', color: 'var(--gray-400)', fontSize: 13, padding: '40px 0' },
};
