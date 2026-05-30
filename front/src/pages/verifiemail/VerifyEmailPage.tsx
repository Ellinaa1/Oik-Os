import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useVerifyEmailStore } from '@/store/auth/verifyEmail.store';
import Spinner from '@/components/common/spiner';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const { verifyStatus, verifyMessage, verifyEmailToken, resetVerifyStatus } = useVerifyEmailStore();

  useEffect(() => {
    if (token) {
      verifyEmailToken(token);
    } else {
      // No token in URL - treat as error
      resetVerifyStatus();
    }
  }, [token, verifyEmailToken, resetVerifyStatus]);

  const handleContinue = () => {
    // Navigate to next step (setup page)
    navigate('/setup');
  };

  const handleResendEmail = () => {
    // Trigger resend email flow
    // Here you can either call a store action to resend the email, 
    // or navigate to a request-verification page.
    navigate('/resend-verification');
  };

  if (verifyStatus === 'loading') {
    return (
      <div className="verify-email-page">
        <div className="verify-email-container">
          <Spinner />
          <p className="verify-message">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (verifyStatus === 'success') {
    return (
      <div className="verify-email-page">
        <div className="verify-email-container">
          <div className="success-icon">✓</div>
          <h2 className="verify-title">Email Verified!</h2>
          <p className="verify-message">{verifyMessage}</p>
          <button className="verify-button primary" onClick={handleContinue}>
            Continue to setup →
          </button>
        </div>
      </div>
    );
  }

  if (verifyStatus === 'error') {
    return (
      <div className="verify-email-page">
        <div className="verify-email-container">
          <div className="error-icon">✕</div>
          <h2 className="verify-title">Verification Failed</h2>
          <p className="verify-message">{verifyMessage}</p>
          <button className="verify-button secondary" onClick={handleResendEmail}>
            Resend email
          </button>
        </div>
      </div>
    );
  }

  // Idle state - show loading initially while checking token
  return (
    <div className="verify-email-page">
      <div className="verify-email-container">
        <Spinner />
        <p className="verify-message">Preparing...</p>
      </div>
    </div>
  );
};

export default VerifyEmailPage;