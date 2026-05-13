import { StaffRole } from '../../modules/auth/domain/auth.types';

export type CustomerPrincipal = {
  subjectType: 'CUSTOMER';
  customerId: string;
};

export type StaffPrincipal = {
  subjectType: 'STAFF';
  staffId: string;
  staffRole: StaffRole;
};

export type CurrentPrincipal = CustomerPrincipal | StaffPrincipal;

export type ActorSnapshot = {
  actorType: CurrentPrincipal['subjectType'];
  actorId: string;
  staffRole: StaffRole | null;
};

export function toActorSnapshot(principal: CurrentPrincipal): ActorSnapshot {
  if (principal.subjectType === 'CUSTOMER') {
    return {
      actorType: 'CUSTOMER',
      actorId: principal.customerId,
      staffRole: null,
    };
  }

  return {
    actorType: 'STAFF',
    actorId: principal.staffId,
    staffRole: principal.staffRole,
  };
}
