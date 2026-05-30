import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import VerifyEmailPage from '@/pages/verifiemail/VerifyEmailPage';
import MembersManagementPage from '@/pages/members/MembersManagementPage';
import CalendarPage from '@/pages/calendar/CalendarPage';
import ProfileSettingsPage from '@/pages/settings/ProfileSettingsPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/calendar" replace />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/settings" element={<ProfileSettingsPage />} />
        <Route path="/members" element={<MembersManagementPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
