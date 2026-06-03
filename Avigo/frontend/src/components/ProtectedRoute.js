import { Navigate } from 'react-router-dom';

const isAuthenticated = () => {
  return Boolean(localStorage.getItem('trip-planner-user'));
};

export default function ProtectedRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
