import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Activity } from 'lucide-react';
import api from '../utils/api';

export default function Login({ setRole }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      setRole(data.role);

      if (data.role === 'Admin') navigate('/admin');
      else navigate('/volunteer');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-dynamic">
      <div className="glass-panel w-full max-w-md p-10 space-y-8">
        <div className="text-center">
          <div className="mx-auto bg-gradient-to-br from-brand-500 to-brand-600 w-20 h-20 flex items-center justify-center rounded-3xl shadow-xl shadow-brand-500/30 mb-6 text-white transform -translate-y-4">
            <Activity size={40} />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Event Portal</h2>
          <p className="text-slate-500 mt-2 font-medium">Secure Entry Management</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium text-center border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6 mt-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Username</label>
            <input
              type="text"
              required
              className="premium-input"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
            <input
              type="password"
              required
              className="premium-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="premium-button mt-4"
          >
            {loading ? 'Authenticating...' : 'Secure Sign In'}
            {!loading && <LogIn size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
}
