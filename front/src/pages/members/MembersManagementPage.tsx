import { useEffect, useMemo, useState } from 'react';
import { cancelHouseholdInvite, getMyHousehold, sendHouseholdInvite } from '@/api/household.api';
import { useAuth } from '@/auth/useAuth';
import InviteModal from '@/components/members/InviteModal';
import MemberCard from '@/components/members/MemberCard';
import PendingInviteRow from '@/components/members/PendingInviteRow';
import type { Household, Invite } from '@/types/household';
import './MembersManagementPage.css';

const MembersManagementPage = () => {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';

  const [household, setHousehold] = useState<Household | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [isSubmittingInvite, setSubmittingInvite] = useState(false);
  const [inviteSubmitError, setInviteSubmitError] = useState<string | null>(null);

  const [inviteBeingCancelled, setInviteBeingCancelled] = useState<string | null>(null);

  const pendingInvites = useMemo<Invite[]>(() => household?.pendingInvites ?? [], [household]);

  const loadHousehold = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const payload = await getMyHousehold();
      setHousehold(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load household data.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadHousehold();
  }, []);

  const handleSubmitInvite = async (payload: { email: string; role: 'admin' | 'member' }) => {
    try {
      setSubmittingInvite(true);
      setInviteSubmitError(null);

      const newInvite = await sendHouseholdInvite(payload);
      setHousehold((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          pendingInvites: [newInvite, ...prev.pendingInvites],
        };
      });

      setInviteModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send invite.';
      setInviteSubmitError(message);
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      setInviteBeingCancelled(inviteId);
      await cancelHouseholdInvite(inviteId);

      setHousehold((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          pendingInvites: prev.pendingInvites.filter((invite) => invite.id !== inviteId),
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel invite.';
      setError(message);
    } finally {
      setInviteBeingCancelled(null);
    }
  };

  return (
    <main className="members-screen">
      <section className="members-hero">
        <div>
          <p className="eyebrow">Household</p>
          <h1>Members Management</h1>
          <p className="subtitle">Manage active members and pending invitations in one place.</p>
        </div>

        {isAdmin ? (
          <button type="button" className="btn btn-primary" onClick={() => setInviteModalOpen(true)}>
            Invite Member
          </button>
        ) : null}
      </section>

      {isLoading ? <div className="state-box">Loading household members...</div> : null}
      {error ? (
        <div className="state-box state-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary" onClick={() => void loadHousehold()}>
            Retry
          </button>
        </div>
      ) : null}

      {!isLoading && !error && household ? (
        <>
          <section className="panel">
            <div className="panel-head">
              <h2>Active Members</h2>
              <span className="counter-pill">{household.members.length}</span>
            </div>

            {household.members.length > 0 ? (
              <div className="member-grid">
                {household.members.map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </div>
            ) : (
              <p className="empty-text">No members found in this household.</p>
            )}
          </section>

          <section className="panel panel-invites">
            <div className="panel-head">
              <h2>Pending Invites</h2>
              <span className="counter-pill">{pendingInvites.length}</span>
            </div>

            {pendingInvites.length > 0 ? (
              <ul className="pending-invite-list">
                {pendingInvites.map((invite) => (
                  <PendingInviteRow
                    key={invite.id}
                    invite={invite}
                    canCancel={isAdmin}
                    isCancelling={inviteBeingCancelled === invite.id}
                    onCancel={handleCancelInvite}
                  />
                ))}
              </ul>
            ) : (
              <p className="empty-text">No pending invites.</p>
            )}
          </section>
        </>
      ) : null}

      <InviteModal
        isOpen={isInviteModalOpen}
        isSubmitting={isSubmittingInvite}
        submitError={inviteSubmitError}
        onClose={() => {
          if (!isSubmittingInvite) {
            setInviteModalOpen(false);
            setInviteSubmitError(null);
          }
        }}
        onSubmit={handleSubmitInvite}
      />
    </main>
  );
};

export default MembersManagementPage;
