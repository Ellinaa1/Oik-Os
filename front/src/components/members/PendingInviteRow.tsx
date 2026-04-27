import type { Invite } from '@/types/household';

interface PendingInviteRowProps {
  invite: Invite;
  canCancel: boolean;
  isCancelling: boolean;
  onCancel: (inviteId: string) => void;
}

const formatRole = (role: string): string => {
  if (!role) {
    return 'Member';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
};

const PendingInviteRow = ({ invite, canCancel, isCancelling, onCancel }: PendingInviteRowProps) => {
  return (
    <li className="pending-invite-row">
      <div className="pending-invite-main">
        <p className="pending-invite-email">{invite.email}</p>
        <div className="pending-invite-meta">
          <span className={`role-badge role-${invite.role.toLowerCase()}`}>{formatRole(invite.role)}</span>
          <span className="pending-invite-status">Pending</span>
        </div>
      </div>

      {canCancel ? (
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => onCancel(invite.id)}
          disabled={isCancelling}
        >
          {isCancelling ? 'Cancelling...' : 'Cancel Invite'}
        </button>
      ) : null}
    </li>
  );
};

export default PendingInviteRow;
