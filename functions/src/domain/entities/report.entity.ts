export type ReportStatus = 'pending' | 'investigated' | 'resolved';

export interface Report {
  id?: string;
  agentId: string;
  plateNumber: string;
  location?: { lat: number; lng: number } | null;
  photoUrl?: string;
  address?: string;
  status: ReportStatus;
  timestamp: Date | any;
}
