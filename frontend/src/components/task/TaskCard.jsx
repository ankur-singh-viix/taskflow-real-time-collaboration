import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const PRIORITY_COLORS = {
  high: { bg: '#FFEBE6', text: '#DE350B', label: 'High' },
  medium: { bg: '#FFF3CD', text: '#FF8B00', label: 'Medium' },
  low: { bg: '#E3FCEF', text: '#00875A', label: 'Low' },
};

const AVATAR_COLORS = ['#0052CC','#00875A','#6554C0','#DE350B','#FF8B00','#00B8D9'];

function getAvatarColor(name) {
  return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

export default function TaskCard({ task, onClick, isDragOverlay }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
    disabled: isDragOverlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const priority = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  const assignees = task.assignee_names || [];
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.due_date && task.due_date < today;

  return (
    <div ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) onClick(task);
      }}
      style={{ ...cardStyle, ...style, cursor: isDragOverlay ? 'grabbing' : 'grab' }}>

      <div style={styles.header}>
        <h4 style={styles.title}>{task.title}</h4>
      </div>

      {task.description && (
        <p style={styles.desc}>{task.description}</p>
      )}

      <div style={styles.footer}>
        <span style={{ ...styles.priority, background: priority.bg, color: priority.text }}>
          {priority.label}
        </span>

        <div style={styles.meta}>
          {task.due_date && (
            <span style={{ ...styles.dueDate, color: isOverdue ? 'var(--red)' : 'var(--gray-500)' }}>
              📅 {task.due_date}
            </span>
          )}

          {assignees.length > 0 && (
            <div style={styles.avatars}>
              {assignees.slice(0, 3).map((name, i) => (
                <div key={i} className="avatar"
                  style={{ width: 22, height: 22, fontSize: 9, background: getAvatarColor(name), marginLeft: i > 0 ? -6 : 0, border: '2px solid white', zIndex: i }}>
                  {name?.charAt(0)?.toUpperCase()}
                </div>
              ))}
              {assignees.length > 3 && (
                <span style={styles.moreCount}>+{assignees.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: 'white',
  borderRadius: 8,
  padding: '12px 14px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  border: '1px solid var(--gray-200)',
  userSelect: 'none',
  transition: 'box-shadow 0.15s, transform 0.1s',
};

const styles = {
  header: { marginBottom: 4 },
  title: { fontSize: 13.5, fontWeight: 500, color: 'var(--gray-800)', lineHeight: 1.4 },
  desc: {
    fontSize: 12,
    color: 'var(--gray-500)',
    marginBottom: 8,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 4 },
  priority: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
  },
  meta: { display: 'flex', alignItems: 'center', gap: 8 },
  dueDate: { fontSize: 11, fontWeight: 500 },
  avatars: { display: 'flex', alignItems: 'center' },
  moreCount: { fontSize: 10, color: 'var(--gray-500)', marginLeft: 4 },
};
