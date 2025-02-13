import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

// Layouts
import PublicLayout from './components/layout/PublicLayout';
import PortalLayout from './components/layout/PortalLayout';

// Public Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import SubmitTicket from './pages/public/SubmitTicket';
import TicketSuccess from './pages/public/TicketSuccess';
import Solutions from './pages/public/Solutions';
import FAQ from './pages/public/FAQ';

// Portal Pages
import Dashboard from './pages/portal/Dashboard';
import TaskList from './pages/portal/TaskList';
import TicketList from './pages/portal/TicketList';
import UserList from './pages/portal/UserList';

export default function App() {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <BrowserRouter>
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/submit-ticket" element={<SubmitTicket />} />
            <Route path="/ticket-success" element={<TicketSuccess />} />
            <Route path="/solutions" element={<Solutions />} />
            <Route path="/faq" element={<FAQ />} />
          </Route>

          {/* Portal Routes */}
          <Route path="/portal" element={<PortalLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="tickets" element={<TicketList />} />
            <Route path="tasks" element={<TaskList />} />
            <Route path="users" element={<UserList />} />
          </Route>

          {/* Default route goes to submit ticket */}
          <Route path="/" element={<Navigate to="/submit-ticket" replace />} />
          
          {/* Catch invalid portal routes */}
          <Route path="/portal/*" element={<Navigate to="/portal" replace />} />
          
          {/* Catch all other routes */}
          <Route path="*" element={<Navigate to="/submit-ticket" replace />} />
        </Routes>
      </BrowserRouter>
    </LocalizationProvider>
  );
}
