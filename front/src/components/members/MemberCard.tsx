import type { Member } from '@/types/household';

interface MemberCardProps {
  member: Member;
}

const getInitials = (name: string): string => {
  const segments = name.trim().split(/\s+/).filter(Boolean);
  if (segments.length === 0) {
    return '?';
  }

  if (segments.length === 1) {
    return segments[0][0].toUpperCase();
  }

  return `${segments[0][0]}${segments[1][0]}`.toUpperCase();
};

const formatRole = (role: string): string => {
  if (!role) {
    return 'Member';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
};

const MemberCard = ({ member }: MemberCardProps) => {
  return (
    <article className="member-card">
      <div className="member-avatar-wrap">
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt={`${member.name} avatar`} className="member-avatar" />
        ) : (
          <div className="member-avatar member-avatar-fallback" aria-hidden="true">
            {getInitials(member.name)}
          </div>
        )}
      </div>

      <div className="member-meta">
        <h3>{member.name}</h3>
        {member.email ? <p>{member.email}</p> : null}
      </div>

      <span className={`role-badge role-${member.role.toLowerCase()}`}>{formatRole(member.role)}</span>
    </article>
  );
};

export default MemberCard;
