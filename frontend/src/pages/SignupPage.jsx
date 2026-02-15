import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const { signup, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await signup(form);
    if (result.success) {
      toast.success('Account created!');
      navigate('/dashboard');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>⚡</span>
          <span style={styles.logoText}>TaskFlow</span>
        </div>
        <div className="card" style={styles.card}>
          <h1 style={styles.title}>Create account</h1>
          <p style={styles.subtitle}>Join TaskFlow to collaborate</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="input" type="text" placeholder="John Doe"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required minLength={2} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="input" type="email" placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="input" type="password" placeholder="Min 6 characters"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required minLength={6} />
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={isLoading}
              style={{ justifyContent: 'center', marginTop: 4 }}>
              {isLoading ? <span className="spinner" /> : 'Create Account'}
            </button>
          </form>

          <p style={styles.switchText}>
            Already have an account?{' '}
            <Link to="/login" style={styles.link}>Sign in</Link>
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
  logo: { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 28 },
  logoIcon: { fontSize: 36 },
  logoText: { fontSize: 28, fontWeight: 700, color: 'white' },
  card: { padding: '32px 32px 24px' },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  subtitle: { color: 'var(--gray-500)', fontSize: 14, marginBottom: 24 },
  switchText: { textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--gray-500)' },
  link: { color: 'var(--blue)', fontWeight: 500, textDecoration: 'none' },
};
