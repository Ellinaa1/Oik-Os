import { useEffect, useState } from 'react';

interface InviteModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  onClose: () => void;
  onSubmit: (payload: { email: string; role: 'admin' | 'member' }) => Promise<void>;
}

const InviteModal = ({ isOpen, isSubmitting, submitError, onClose, onSubmit }: InviteModalProps) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setRole('member');
      setValidationError(null);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!/.+@.+\..+/.test(normalizedEmail)) {
      setValidationError('Please enter a valid email address.');
      return;
    }

    setValidationError(null);
    await onSubmit({ email: normalizedEmail, role });
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="invite-member-title">
      <div className="modal-panel">
        <h2 id="invite-member-title">Invite Member</h2>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="modal-label" htmlFor="invite-email">
            Email
          </label>
          <input
            id="invite-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="member@example.com"
            className="modal-input"
            disabled={isSubmitting}
            required
          />

          <label className="modal-label" htmlFor="invite-role">
            Role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(event) => setRole(event.target.value as 'admin' | 'member')}
            className="modal-input"
            disabled={isSubmitting}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>

          {validationError ? <p className="form-error">{validationError}</p> : null}
          {submitError ? <p className="form-error">{submitError}</p> : null}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteModal;
