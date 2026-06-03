import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { verifyOtp } from '../api';

export default function VerifyOtp() {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { type, contact } = location.state || {};

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!contact) {
      setError('Contact is missing. Please signup again.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await verifyOtp({ contact, otp });
      navigate('/set-password', { state: { contact } });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center">
      <section className="surface-card glow-border w-full p-6 sm:p-8 lg:p-10">
        <span className="hero-chip">Verification</span>
        <h1 className="page-title mt-4">Enter your OTP</h1>
        <p className="page-subtitle mt-3">Enter the 6-digit OTP sent to {contact}. In development, check the backend console log.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input name="otp" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit OTP" className="input-field tracking-[0.3em] text-center text-lg" required />
          {error && <p className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
          <button type="submit" disabled={loading} className="primary-btn w-full">
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>
        <p className="mt-5 text-sm text-slate-300">Go back to <Link to="/signup" className="font-semibold text-cyan-300 hover:text-cyan-200">Signup</Link></p>
      </section>
    </motion.div>
  );
}
