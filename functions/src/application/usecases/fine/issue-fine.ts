import { ReportRepository } from '../../../domain/repositories/report.repository';
import { FineRepository } from '../../../domain/repositories/fine.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { Fine } from '../../../domain/entities/fine.entity';

export interface IssueFineRequest {
  reportId: string;
  ownerId: string;
  plateNumber: string;
  amount: number;
  notes?: string;
  issuedBy: string;
  batch?: any; // Accepting optional batch
}

export class IssueFineUseCase {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly fineRepository: FineRepository,
    private readonly userRepository: UserRepository
  ) {}

  async execute(request: IssueFineRequest) {
    const caller = await this.userRepository.getById(request.issuedBy);
    if (!caller || caller.role !== 'police') {
      throw new Error('Only police officers can issue fines');
    }

    const { reportId, ownerId, plateNumber, amount, notes, batch } = request;

    if (!reportId || !ownerId || !plateNumber || !amount) {
      throw new Error('reportId, ownerId, plateNumber, and amount are required');
    }

    await this.reportRepository.updateStatus(reportId, 'investigated', batch);

    const fine: Omit<Fine, 'id'> = {
      reportId,
      ownerId,
      plateNumber: String(plateNumber).toUpperCase(),
      amount: Number(amount),
      status: 'unpaid',
      notes: notes ?? '',
      issuedBy: request.issuedBy,
      issuedAt: new Date(),
    };

    const fineId = await this.fineRepository.create(fine, batch);

    return { ok: true, fineId };
  }
}
