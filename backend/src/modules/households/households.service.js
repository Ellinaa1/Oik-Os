const { HttpError } = require('../../utils/httpError');
const { getDb } = require('../../db/connection');
const {
  createHouseholdTx,
  createHouseholdMemberTx,
  getHouseholdWithMembersById,
} = require('./households.repository');

const VALID_MEMBER_ROLES = new Set(['adult', 'member', 'child']);

const normalizeDateOfBirth = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new HttpError(400, 'dateOfBirth must be in YYYY-MM-DD format.');
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new HttpError(400, 'dateOfBirth is invalid.');
  }

  return normalized;
};

const normalizeMemberInput = (member, index) => {
  const name = String(member?.name || '').trim();
  const rawRole = String(member?.role || '').trim().toLowerCase();

  if (!name) {
    throw new HttpError(400, `members[${index}].name is required.`);
  }

  if (!rawRole) {
    throw new HttpError(400, `members[${index}].role is required.`);
  }

  if (rawRole === 'admin') {
    throw new HttpError(400, 'Admin role is reserved for the household creator.');
  }

  if (!VALID_MEMBER_ROLES.has(rawRole)) {
    throw new HttpError(400, `members[${index}].role must be one of: adult, member, child.`);
  }

  return {
    name,
    role: rawRole,
    dateOfBirth: normalizeDateOfBirth(member?.dateOfBirth),
  };
};

const serializeHousehold = (household) => {
  return {
    id: household.id,
    name: household.name,
    createdByUserId: household.created_by_user_id,
    createdAt: household.created_at,
    updatedAt: household.updated_at,
    members: household.members.map((member) => ({
      id: member.id,
      householdId: member.household_id,
      userId: member.user_id,
      name: member.name,
      role: member.role,
      dateOfBirth: member.date_of_birth,
      canManageHousehold: Boolean(member.can_manage_household),
      createdAt: member.created_at,
      updatedAt: member.updated_at,
    })),
  };
};

const createHousehold = async ({ payload, creatorUser }) => {
  const name = String(payload?.name || '').trim();
  const hasMembersField = Object.prototype.hasOwnProperty.call(payload || {}, 'members');
  const members = Array.isArray(payload?.members) ? payload.members : [];

  if (!name) {
    throw new HttpError(400, 'name is required.');
  }

  if (hasMembersField && !Array.isArray(payload.members)) {
    throw new HttpError(400, 'members must be an array.');
  }

  const normalizedMembers = members.map((member, index) => normalizeMemberInput(member, index));

  const db = await getDb();
  await db.exec('BEGIN TRANSACTION;');

  try {
    const householdId = await createHouseholdTx(db, {
      name,
      createdByUserId: creatorUser.id,
    });

    const creatorName = String(creatorUser.email || `User #${creatorUser.id}`).trim();

    await createHouseholdMemberTx(db, {
      householdId,
      userId: creatorUser.id,
      name: creatorName,
      role: 'admin',
      dateOfBirth: null,
      canManageHousehold: true,
    });

    for (const member of normalizedMembers) {
      await createHouseholdMemberTx(db, {
        householdId,
        userId: null,
        name: member.name,
        role: member.role,
        dateOfBirth: member.dateOfBirth,
        canManageHousehold: member.role !== 'child',
      });
    }

    const household = await getHouseholdWithMembersById(householdId, db);

    await db.exec('COMMIT;');

    return {
      statusCode: 201,
      household: serializeHousehold(household),
    };
  } catch (error) {
    await db.exec('ROLLBACK;');
    throw error;
  }
};

module.exports = {
  createHousehold,
};
