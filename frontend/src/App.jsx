import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import VolunteerScanner from './pages/VolunteerScanner';
import ExternalVerify from './pages/ExternalVerify';

function App() {
  const [role, setRole] = useState(localStorage.getItem('role') || null);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setRole(null);
  };

  const isVolunteer = role === 'Volunteer' || role === 'EntryVolunteer' || role === 'FoodVolunteer';

  return (
    <ThemeProvider>
      <ToastProvider>
        <Router>
          <div className="app-bg">
            <Routes>
              <Route path="/"
                element={<Navigate to={role ? (role === 'Admin' ? '/admin' : '/volunteer') : '/login'} />}
              />
              <Route path="/login"
                element={!role ? <Login setRole={setRole} /> : <Navigate to="/" />}
              />
              <Route path="/admin"
                element={role === 'Admin' ? <AdminDashboard onLogout={handleLogout} /> : <Navigate to="/" />}
              />
              <Route path="/volunteer"
                element={isVolunteer ? <VolunteerScanner role={role} onLogout={handleLogout} /> : <Navigate to="/login" />}
              />
              <Route path="/verify/:token" element={<ExternalVerify />} />
            </Routes>
          </div>
        </Router>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
