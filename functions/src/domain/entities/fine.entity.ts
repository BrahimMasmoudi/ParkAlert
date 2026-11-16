import { ReportPhoto } from './report.entity';

export type FineStatus = 'unpaid' | 'paid' | 'cancelled';

export type DisputeStatus = 'none' | 'pending' | 'accepted' | 'rejected';

export interface Fine {
  id?: string;
  reportId: string;
  ownerId: string;
  plateNumber: string;
  plateNumberNormalized: string;
  amount: number;
  status: FineStatus;
  disputeStatus?: DisputeStatus;
  evidencePhotos?: ReportPhoto[];
  originalPlateNumber?: string;
  plateCorrectedBy?: string;
  plateCorrectedAt?: Date | any;
  disputeReason?: string;
  disputedAt?: Date | any;
  resolutionReason?: string;
  resolvedBy?: string;
  resolvedAt?: Date | any;
  notes?: string;
  issuedBy: string;
  issuedAt: Date | any;
  paidAt?: Date | any;
}
