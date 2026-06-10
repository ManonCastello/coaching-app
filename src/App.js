// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ClientDashboard from './pages/ClientDashboard';
import DailyCheckIn from './pages/DailyCheckIn';
import WeeklyCheckIn from './pages/WeeklyCheckIn';
import ClientProfile from './pages/ClientProfile';
import CoachDashboard from './pages/CoachDashboard';
import CoachClientDetail from './pages/CoachClientDetail';
import ProgressPage from './pages/ProgressPage';

import './styles/global.css';

function PrivateRoute({ children, requireCoach }) {
  const { currentUser, userRole } = useAuth();
  if (!currentUser) return <Navigate to="/login" />;
  if (requireCoach && userRole !== 'coach') return <Navigate to="/dashboard" />;
  return children;
}

function AppRoutes() {
  const { currentUser, userRole } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={
        currentUser ? <Navigate to={userRole === 'coach' ? '/coach' : '/dashboard'} /> : <LoginPage />
      } />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/dashboard" element={<PrivateRoute><ClientDashboard /></PrivateRoute>} />
      <Route path="/checkin/daily" element={<PrivateRoute><DailyCheckIn /></PrivateRoute>} />
      <Route path="/checkin/weekly" element={<PrivateRoute><WeeklyCheckIn /></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><ClientProfile /></PrivateRoute>} />
      <Route path="/progress" element={<PrivateRoute><ProgressPage /></PrivateRoute>} />
      <Route path="/coach" element={<PrivateRoute requireCoach><CoachDashboard /></PrivateRoute>} />
      <Route path="/coach/client/:clientId" element={<PrivateRoute requireCoach><CoachClientDetail /></PrivateRoute>} />
      <Route path="/coach/my-checkin" element={<PrivateRoute requireCoach><DailyCheckIn coachMode /></PrivateRoute>} />
      <Route path="/coach/my-weekly" element={<PrivateRoute requireCoach><WeeklyCheckIn coachMode /></PrivateRoute>} />
      <Route path="/coach/my-progress" element={<PrivateRoute requireCoach><ProgressPage coachMode /></PrivateRoute>} />
      <Route path="*" element={
        currentUser ? <Navigate to={userRole === 'coach' ? '/coach' : '/dashboard'} /> : <Navigate to="/login" />
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
