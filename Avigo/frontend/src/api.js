import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

export const signup = (payload) => axios.post(`${API_BASE}/signup`, payload);
export const login = (payload) => axios.post(`${API_BASE}/login`, payload);
export const getPendingUsers = () => axios.get(`${API_BASE}/get-pending-users`);
export const approveUser = (payload) => axios.post(`${API_BASE}/approve-user`, payload);
export const rejectUser = (payload) => axios.post(`${API_BASE}/reject-user`, payload);
export const planTrip = (payload) => axios.post(`${API_BASE}/plan-trip`, payload);
