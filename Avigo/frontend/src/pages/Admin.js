import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getPendingUsers, approveUser, rejectUser } from '../api';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await getPendingUsers();
      setUsers(response.data.users);
    } catch (err) {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (email) => {
    try {
      await approveUser({ email });
      setUsers(users.filter(user => user.email !== email));
    } catch (err) {
      setError('Failed to approve user');
    }
  };

  const handleReject = async (email) => {
    try {
      await rejectUser({ email });
      setUsers(users.filter(user => user.email !== email));
    } catch (err) {
      setError('Failed to reject user');
    }
  };

  if (loading) return <div className="text-center mt-16">Loading...</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl">
      <section className="surface-card glow-border p-6 sm:p-8 lg:p-10">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="hero-chip">Admin control</span>
            <h1 className="page-title mt-4">Pending users</h1>
            <p className="page-subtitle mt-3">Review signup requests and approve users before they can access planning tools.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
            <div className="stat-card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending</p>
              <p className="mt-2 text-2xl font-black">{users.length}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Action</p>
              <p className="mt-2 text-2xl font-black">Review</p>
            </div>
          </div>
        </div>

        {error && <p className="mb-4 rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
        {users.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-300">No pending users.</div>
        ) : (
          <div className="card-grid">
            {users.map((user) => (
              <div key={user.id} className="data-card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-white">{user.email}</p>
                  <p className="text-sm text-slate-400">Waiting for admin approval</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => handleApprove(user.email)} className="primary-btn px-4 py-2">
                    Approve
                  </button>
                  <button onClick={() => handleReject(user.email)} className="secondary-btn px-4 py-2 text-rose-200 hover:border-rose-400/40 hover:bg-rose-400/10">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}