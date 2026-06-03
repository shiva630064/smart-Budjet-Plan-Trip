import { Routes, Route, Navigate } from 'react-router-dom';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Planner from './pages/Planner';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <div className="page-shell">
      <div className="page-container">
        <Routes>
          <Route path="/" element={<Navigate to="/signup" />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/planner" element={<ProtectedRoute><Planner /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/signup" />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
