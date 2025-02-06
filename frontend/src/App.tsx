import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeContextProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import PortalLayout from './components/layout/PortalLayout';
import TaskList from './pages/portal/TaskList';
import TicketList from './pages/portal/TicketList';
import UserList from './pages/portal/UserList';
import SubmitTicket from './pages/public/SubmitTicket';
import TicketSuccess from './pages/public/TicketSuccess';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeContextProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/submit-ticket" element={<SubmitTicket />} />
              <Route path="/ticket-success" element={<TicketSuccess />} />

              {/* Portal Routes */}
              <Route path="/portal" element={<PortalLayout />}>
                <Route index element={<TaskList />} />
                <Route path="tickets" element={<TicketList />} />
                <Route path="tasks" element={<TaskList />} />
                <Route path="users" element={<UserList />} />
              </Route>

              {/* Redirect root to portal */}
              <Route path="/" element={<Navigate to="/portal" replace />} />
              
              {/* Catch all other routes */}
              <Route path="*" element={<Navigate to="/portal" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeContextProvider>
    </QueryClientProvider>
  );
}
