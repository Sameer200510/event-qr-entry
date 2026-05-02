import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, Eye, EyeOff, Moon, Sun, ShieldCheck, Utensils, User } from 'lucide-react';
import api from '../utils/api';
import { useTheme } from '../context/ThemeContext';

export default function Login({ setRole }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { dark, setDark } = useTheme();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      setRole(data.role);
      navigate(data.role === 'Admin' ? '/admin' : '/volunteer');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { icon: <ShieldCheck size={16} />, label: 'Admin', color: '#6366f1' },
    { icon: <User size={16} />, label: 'Entry', color: '#10b981' },
    { icon: <Utensils size={16} />, label: 'Food', color: '#f59e0b' },
  ];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-5 relative overflow-hidden"
      style={{ background: dark
        ? 'radial-gradient(ellipse at 30% 20%, #1e1b4b 0%, #0b0f1a 60%)'
        : 'radial-gradient(ellipse at 30% 20%, #e0e7ff 0%, #f8fafc 60%)' }}
    >
      {/* Background blobs */}
      <div aria-hidden style={{
        position: 'absolute', top: '-10%', right: '-10%',
        width: 400, height: 400, borderRadius: '50%',
        background: dark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.12)',
        filter: 'blur(60px)', pointerEvents: 'none'
      }} />
      <div aria-hidden style={{
        position: 'absolute', bottom: '-10%', left: '-10%',
        width: 350, height: 350, borderRadius: '50%',
        background: dark ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.1)',
        filter: 'blur(60px)', pointerEvents: 'none'
      }} />

      {/* Theme Toggle */}
      <button
        onClick={() => setDark(!dark)}
        className="btn-icon"
        style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 10 }}
        aria-label="Toggle theme"
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Logo + Title */}
      <div className="animate-fade-in text-center mb-8">
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1rem', boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
          position: 'relative'
        }}>
          <ScanLine size={36} color="#fff" />
          <span style={{
            position: 'absolute', inset: -4, borderRadius: 24,
            border: '2px solid rgba(99,102,241,0.3)',
            animation: 'pulse-ring 2s ease-out infinite'
          }} />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Event QR Portal
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.375rem', fontWeight: 500 }}>
          Secure Entry &amp; Food Management System
        </p>
      </div>

      {/* Login Card */}
      <div
        className="card animate-slide-up"
        style={{ width: '100%', maxWidth: 420, padding: '2rem' }}
      >
        {/* Role pills */}
        <div style={{
          display: 'flex', gap: '0.5rem', marginBottom: '1.5rem',
          background: 'var(--surface-2)', borderRadius: 12, padding: '0.375rem'
        }}>
          {roles.map(r => (
            <div key={r.label} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.375rem', padding: '0.5rem 0.25rem', borderRadius: 8,
              fontSize: '0.75rem', fontWeight: 700, color: r.color,
              background: 'var(--surface)', border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              {r.icon}{r.label}
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem', fontWeight: 500 }}>
          One login for all roles
        </p>

        {/* Error */}
        {error && (
          <div className="animate-fade-in" style={{
            background: 'var(--red-light)', color: 'var(--red)',
            border: '1px solid', borderColor: 'var(--red)', borderRadius: 10,
            padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
          <div>
            <label className="input-label" htmlFor="login-username">Username</label>
            <input
              id="login-username"
              className="input"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div>
            <label className="input-label" htmlFor="login-password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: '0.875rem', top: '50%',
                  transform: 'translateY(-50%)', background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            id="login-btn"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.25rem', padding: '0.875rem', fontSize: '1rem' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 20, height: 20, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} className="animate-spin" />
                Signing in…
              </span>
            ) : 'Sign In →'}
          </button>
        </form>
      </div>

      {/* Watermark */}
      <div className="watermark">Designed by SAMEER LOHANI &amp; VARUN DOBHAL</div>
    </div>
  );
}
