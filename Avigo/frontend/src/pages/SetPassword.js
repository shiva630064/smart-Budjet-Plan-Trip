import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { setPassword } from '../api';

export default function SetPassword() {
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const contact = location.state?.contact || '';

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!contact) {
      setError('Contact is missing. Please start over.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await setPassword({ contact, password: form.password });
      navigate('/login', { state: { message: 'Account created. Please login.' } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center">
      <section className="surface-card glow-border w-full p-6 sm:p-8 lg:p-10">
        <span className="hero-chip">Finalize account</span>
        <h1 className="page-title mt-4">Set your password</h1>
        <p className="page-subtitle mt-3">Create a password for {contact} and finish account setup.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Password" className="input-field" required />
          <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Confirm password" className="input-field" required />
          {error && <p className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
          <button type="submit" disabled={loading} className="primary-btn w-full">
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        <p className="mt-5 text-sm text-slate-300">Go back to <Link to="/signup" className="font-semibold text-cyan-300 hover:text-cyan-200">Signup</Link></p>
      </section>
    </motion.div>
  );
}