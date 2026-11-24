import { ReportPhoto } from './report.entity';
import { CardBrand } from '../value-objects/payment';

export type FineStatus = 'unpaid' | 'paid' | 'cancelled';

export type DisputeStatus = 'none' | 'pending' | 'accepted' | 'rejected';

export interface FineReceiptSummary {
  cardholderName: string;
  cardBrand: CardBrand;
  cardLast4: string;
}

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
  paymentReference?: string;
  paymentProvider?: 'simulated';
  paymentAttemptId?: string;
}
