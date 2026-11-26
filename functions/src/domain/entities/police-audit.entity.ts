export type PoliceAuditTargetType = 'car' | 'report' | 'fine';

export type PoliceAuditAction =
  | 'CAR_APPROVED'
  | 'CAR_REJECTED'
  | 'CAR_DELETION_APPROVED'
  | 'TRANSFER_APPROVED'
  | 'TRANSFER_REJECTED'
  | 'DISMISS_REPORT'
  | 'ISSUE_FINE'
  | 'CANCEL_FINE'
  | 'DISMISS_DISPUTE';

export interface PoliceAuditMetadata {
  originalPlateNumber?: string;
}

export interface PoliceAuditLog {
  id?: string;
  targetType: PoliceAuditTargetType;
  targetId: string;
  actorId: string;
  ownerId: string;
  plateNumber: string;
  plateNumberNormalized: string;
  action: PoliceAuditAction;
  reason: string | null;
  metadata?: PoliceAuditMetadata;
  timestamp: Date | any;
}
