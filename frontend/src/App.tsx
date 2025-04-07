import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AuthLayout from './layouts/AuthLayout';
import MainLayout from './layouts/MainLayout';
import PublicLayout from './layouts/PublicLayout';

// Public pages
import HomePage from './pages/public/HomePage';
import CreateTicketPage from './pages/public/CreateTicketPage';
import FAQPage from './pages/public/FAQPage';
import LoginPage from './pages/auth/LoginPage';

// Auth pages
import DashboardPage from './pages/dashboard/DashboardPage';
import TicketsPage from './pages/dashboard/TicketsPage';
import TicketDetailPage from './pages/dashboard/TicketDetailPage';
import TasksPage from './pages/dashboard/TasksPage';
import TaskDetailPage from './pages/dashboard/TaskDetailPage';
import UsersPage from './pages/dashboard/UsersPage';
import UserFormPage from './pages/dashboard/UserFormPage';
import SettingsPage from './pages/dashboard/SettingsPage';
import ProfilePage from './pages/dashboard/ProfilePage';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/create-ticket" element={<CreateTicketPage />} />
            <Route path="/faq" element={<FAQPage />} />
          </Route>

          {/* Authentication Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Protected Routes */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/:id" element={<TaskDetailPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/new" element={<UserFormPage />} />
            <Route path="/users/:id" element={<UserFormPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;