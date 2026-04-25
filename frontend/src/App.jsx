import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import VolunteerScanner from './pages/VolunteerScanner';

function App() {
  const [role, setRole] = useState(localStorage.getItem('role') || null);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setRole(null);
  };

  return (
    <Router>
      <div className="min-h-screen bg-dynamic">
        {role && (
          <header className="bg-white shadow-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
              <h1 className="font-bold text-xl text-brand-600 hidden sm:block">Event QR System</h1>
              <div className="flex items-center gap-4 text-sm font-medium">
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full border border-slate-200">
                  {role}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-red-500 hover:text-red-700 transition"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>
        )}
        <Routes>
          <Route path="/" element={<Navigate to={role ? (role === 'Admin' ? '/admin' : '/volunteer') : '/login'} />} />
          <Route path="/login" element={!role ? <Login setRole={setRole} /> : <Navigate to="/" />} />
          <Route path="/admin" element={role === 'Admin' ? <AdminDashboard /> : <Navigate to="/" />} />
          <Route path="/volunteer" element={role ? <VolunteerScanner /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
