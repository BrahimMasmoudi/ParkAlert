export type CarStatus = 'activation_pending' | 'active' | 'rejected' | 'deletion_requested' | 'archived' | 'transfer_requested';

export interface Car {
  id: string;
  ownerId: string;
  plateNumber: string;
  brand: string;
  model: string;
  color: string;
  carteGriseUrl: string;
  status: CarStatus;
  createdAt: Date | any;
  updatedAt?: Date | any;
  rejectionReason?: string | null;
  deletionRequestedAt?: Date | any | null;
  archivedAt?: Date | any | null;
  archivedBy?: string | null;
  transferToOwnerId?: string | null;
  transferCarteGriseUrl?: string | null;
  transferRequestedAt?: Date | any | null;
  transferRejectionReason?: string | null;
  ownershipHistory?: string[];
}

export interface CarAuditLog {
  id?: string;
  carId: string;
  actorId: string;
  action: string;
  timestamp: Date | any;
  details?: string;
  reason?: string;
}
