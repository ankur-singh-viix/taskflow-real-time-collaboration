import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(form);
    if (result.success) {
      toast.success('Welcome back!');
      navigate('/dashboard');
    } else {
      toast.error(result.error);
    }
  };

  const fillDemo = (email) => {
    setForm({ email, password: 'password123' });
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>⚡</span>
          <span style={styles.logoText}>TaskFlow</span>
        </div>

        <div className="card" style={styles.card}>
          <h1 style={styles.title}>Welcome back</h1>
          <p style={styles.subtitle}>Sign in to your account</p>

          <div style={styles.demoBadge}>
            <p style={styles.demoTitle}>🎯 Demo accounts</p>
            <div style={styles.demoButtons}>
              {['alice@taskflow.com', 'bob@taskflow.com', 'carol@taskflow.com'].map(email => (
                <button key={email} className="btn btn-secondary btn-sm"
                  onClick={() => fillDemo(email)} type="button">
                  {email.split('@')[0]}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={isLoading}
              style={{ justifyContent: 'center', marginTop: 4 }}>
              {isLoading ? <span className="spinner" /> : 'Sign In'}
            </button>
          </form>

          <p style={styles.switchText}>
            Don't have an account?{' '}
            <Link to="/signup" style={styles.link}>Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 16,
  },
  container: { width: '100%', maxWidth: 400 },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 28,
  },
  logoIcon: { fontSize: 36 },
  logoText: { fontSize: 28, fontWeight: 700, color: 'white' },
  card: { padding: '32px 32px 24px' },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  subtitle: { color: 'var(--gray-500)', fontSize: 14, marginBottom: 24 },
  demoBadge: {
    background: 'var(--blue-light)',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 24,
  },
  demoTitle: { fontSize: 13, fontWeight: 600, color: 'var(--blue)', marginBottom: 8 },
  demoButtons: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  switchText: { textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--gray-500)' },
  link: { color: 'var(--blue)', fontWeight: 500, textDecoration: 'none' },
};
