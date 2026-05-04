import { FineRepository } from '../../../domain/repositories/fine.repository';
import { ReportRepository } from '../../../domain/repositories/report.repository';

export interface PayFineRequest {
  fineId: string;
  userId: string;
  batch?: any;
}

export class PayFineUseCase {
  constructor(
    private readonly fineRepository: FineRepository,
    private readonly reportRepository: ReportRepository
  ) {}

  async execute(request: PayFineRequest) {
    const { fineId, userId, batch } = request;
    if (!fineId) throw new Error('fineId is required');

    const fine = await this.fineRepository.getById(fineId);
    if (!fine) throw new Error('Fine not found');

    if (fine.ownerId !== userId) {
      throw new Error('You can only pay your own fines');
    }
    if (fine.status === 'paid') {
      throw new Error('This fine is already paid');
    }

    await this.fineRepository.update(fineId, { status: 'paid' }, batch);

    if (fine.reportId) {
      await this.reportRepository.updateStatus(fine.reportId, 'resolved', batch);
    }

    return { ok: true };
  }
}
