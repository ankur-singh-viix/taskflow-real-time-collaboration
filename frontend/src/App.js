import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import BoardPage from './pages/BoardPage';
import './index.css';

/* =========================
   ROUTE GUARDS
========================= */

function PrivateRoute({ children }) {
  const token = useAuthStore(s => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const token = useAuthStore(s => s.token);
  return !token ? children : <Navigate to="/dashboard" replace />;
}

/* =========================
   APP
========================= */

export default function App() {
  const token = useAuthStore(s => s.token);
  const initSocket = useAuthStore(s => s.initSocket);

  useEffect(() => {
    if (token) {
      initSocket();   // connect socket ONLY when token exists
    }
  }, [token, initSocket]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontFamily: 'Inter, sans-serif', fontSize: '14px' },
        }}
      />

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignupPage />
            </PublicRoute>
          }
        />

        <Route
          path="/dashboard"element={<PrivateRoute><DashboardPage /></PrivateRoute> }
        />

        <Route
          path="/board/:boardId"
          element={
            <PrivateRoute>
              <BoardPage />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}