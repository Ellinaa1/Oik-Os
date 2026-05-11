export type HouseholdRole = 'admin' | 'member' | string;

export interface Member {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  role: HouseholdRole;
}

export interface Invite {
  id: string;
  email: string;
  role: HouseholdRole;
  status: 'pending' | string;
  invitedByName?: string;
  createdAt?: string;
}

export interface Household {
  id: string;
  name?: string;
  members: Member[];
  pendingInvites: Invite[];
}

export interface InviteMemberPayload {
  email: string;
  role: HouseholdRole;
}
