import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { signup } from '../api';

export default function Signup() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup(form);
      navigate('/login', { state: { message: 'Signup request sent. Please wait for admin approval.' } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
      <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="surface-card glow-border hidden overflow-hidden p-8 lg:flex lg:flex-col lg:justify-between">
          <div>
            <span className="hero-chip">Join the planner</span>
            <h1 className="mt-5 text-4xl font-black leading-tight text-white">Create an account and get trips approved, planned, and organized.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">Users sign up once, wait for admin approval, and then unlock the full budget trip planning experience.</p>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-3">
            <div className="stat-card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Approval</p>
              <p className="mt-2 text-lg font-bold">Pending</p>
            </div>
            <div className="stat-card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trips</p>
              <p className="mt-2 text-lg font-bold">Smart</p>
            </div>
            <div className="stat-card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Safety</p>
              <p className="mt-2 text-lg font-bold">Built-in</p>
            </div>
          </div>
        </aside>

        <section className="surface-card glow-border p-6 sm:p-8 lg:p-10">
          <div className="mb-6">
            <span className="hero-chip">Signup Request</span>
            <h2 className="page-title mt-4">Start planning</h2>
            <p className="page-subtitle mt-3">Create your account and wait for admin approval before logging in.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input name="email" value={form.email} onChange={handleChange} placeholder="Email address" className="input-field" required />
            <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Password" className="input-field" required />
            {error && <p className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
            <button type="submit" disabled={loading} className="primary-btn w-full">
              {loading ? 'Sending Request...' : 'Send Signup Request'}
            </button>
          </form>
          <p className="mt-5 text-sm text-slate-300">Already have an account? <Link to="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">Login</Link></p>
        </section>
      </div>
    </motion.div>
  );
}
