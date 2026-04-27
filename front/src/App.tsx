import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import VerifyEmailPage from '@/pages/verifiemail/VerifyEmailPage';
import MembersManagementPage from '@/pages/members/MembersManagementPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/members" replace />} />
        <Route path="/members" element={<MembersManagementPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
