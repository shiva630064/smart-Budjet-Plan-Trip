import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { login } from '../api';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const message = location.state?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await login(form);
      const { user } = response.data;
      localStorage.setItem('trip-planner-user', JSON.stringify(user));
      navigate('/planner');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
      <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="surface-card glow-border hidden overflow-hidden p-8 lg:flex lg:flex-col lg:justify-between">
          <div>
            <span className="hero-chip">Trip Planner AI</span>
            <h1 className="mt-5 text-4xl font-black leading-tight text-white">Plan smarter trips with live routes, places, and safety-aware suggestions.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">A clean dashboard for budget travel, curated stops, admin approval, and real-time Google data.</p>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-3">
            <div className="stat-card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Routes</p>
              <p className="mt-2 text-lg font-bold">Live</p>
            </div>
            <div className="stat-card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Places</p>
              <p className="mt-2 text-lg font-bold">Curated</p>
            </div>
            <div className="stat-card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Safety</p>
              <p className="mt-2 text-lg font-bold">Ready</p>
            </div>
          </div>
        </aside>

        <section className="surface-card glow-border p-6 sm:p-8 lg:p-10">
          <div className="mb-6">
            <span className="hero-chip">Secure Login</span>
            <h2 className="page-title mt-4">Welcome back</h2>
            <p className="page-subtitle mt-3">Sign in to continue your trip planning flow and access your approved account.</p>
          </div>
          {message && <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <input name="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email address" className="input-field" required />
            <input type="password" name="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" className="input-field" required />
            {error && <p className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
            <button type="submit" disabled={loading} className="primary-btn w-full">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <p className="mt-5 text-sm text-slate-300">New here? <Link to="/signup" className="font-semibold text-cyan-300 hover:text-cyan-200">Create an account</Link></p>
        </section>
      </div>
    </motion.div>
  );
}
