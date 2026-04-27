import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import VerifyEmailPage from '@/pages/verifiemail/VerifyEmailPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div><h1>Home Page</h1><p>Go to <Link to="/verify-email?token=some-fake-token">verify page</Link> to test.</p></div>} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
