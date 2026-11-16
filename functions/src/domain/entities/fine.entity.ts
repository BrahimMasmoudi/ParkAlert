export type FineStatus = 'unpaid' | 'paid';

export interface Fine {
  id?: string;
  reportId: string;
  ownerId: string;
  plateNumber: string;
  plateNumberNormalized: string;
  amount: number;
  status: FineStatus;
  notes?: string;
  issuedBy: string;
  issuedAt: Date | any;
  paidAt?: Date | any;
}
