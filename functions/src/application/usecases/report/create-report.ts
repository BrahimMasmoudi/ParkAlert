import { ReportRepository } from '../../../domain/repositories/report.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { Report } from '../../../domain/entities/report.entity';

export interface CreateReportRequest {
  agentId: string;
  plateNumber: string;
  location?: { lat: number; lng: number } | null;
  photoUrl?: string;
  address?: string;
}

export class CreateReportUseCase {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly userRepository: UserRepository
  ) {}

  async execute(request: CreateReportRequest) {
    const user = await this.userRepository.getById(request.agentId);
    if (!user || user.role !== 'agent') {
      throw new Error('Only agents can file reports');
    }

    const { plateNumber, location, photoUrl, address } = request;

    const hasLocation =
      location != null &&
      typeof location.lat === 'number' &&
      typeof location.lng === 'number';
    const hasAddress = typeof address === 'string' && address.trim().length > 0;

    if (!plateNumber || (!hasLocation && !hasAddress)) {
      throw new Error('plateNumber and either location or address are required');
    }

    const report: Omit<Report, 'id'> = {
      agentId: request.agentId,
      plateNumber: String(plateNumber).toUpperCase(),
      location: location ?? null,
      photoUrl: photoUrl ?? '',
      address: address ?? '',
      status: 'pending',
      timestamp: new Date(), // Adapter will replace with serverTimestamp
    };

    const reportId = await this.reportRepository.create(report);
    return { ok: true, reportId };
  }
}
