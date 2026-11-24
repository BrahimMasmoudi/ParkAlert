export type ReportStatus = 'pending' | 'investigated' | 'resolved';

export type ReportPhotoSlot = 'context' | 'plate' | 'extra';

export interface ReportPhoto {
  path: string;
  slot: ReportPhotoSlot;
}

export type EnforcementAuditAction =
  | 'UPDATE_REPORT_PLATE'
  | 'DISMISS_REPORT'
  | 'ISSUE_FINE'
  | 'DISPUTE_FINE'
  | 'DISMISS_DISPUTE'
  | 'CANCEL_FINE'
  | 'PAY_FINE';

export interface EnforcementAuditLog {
  id?: string;
  targetType: 'report' | 'fine';
  targetId: string;
  actorId: string;
  action: EnforcementAuditAction;
  originalPlate?: string;
  issuedPlate?: string;
  reason?: string;
  paymentReference?: string;
  paymentProvider?: string;
  timestamp: Date | any;
}

export interface Report {
  id?: string;
  agentId: string;
  plateNumber: string;
  location?: { lat: number; lng: number } | null;
  photos?: ReportPhoto[];
  photoUrl?: string;
  address?: string;
  status: ReportStatus;
  originalPlateNumber?: string;
  plateCorrectedBy?: string;
  plateCorrectedAt?: Date | any;
  resolutionReason?: string;
  resolvedBy?: string;
  resolvedAt?: Date | any;
  timestamp: Date | any;
}
