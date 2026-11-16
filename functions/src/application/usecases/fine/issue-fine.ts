import { CarRepository } from '../../../domain/repositories/car.repository';
import { ReportRepository } from '../../../domain/repositories/report.repository';
import { FineRepository } from '../../../domain/repositories/fine.repository';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { TransactionRunner } from '../../../domain/repositories/transaction.port';
import { Fine } from '../../../domain/entities/fine.entity';
import { DomainError } from '../../../domain/errors/domain.error';
import { normalizePlate } from '../../../domain/value-objects/plate';

export interface IssueFineRequest {
  reportId: string;
  ownerId: string;
  plateNumber: string;
  amount: number;
  notes?: string;
  issuedBy: string;
}

export class IssueFineUseCase {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly fineRepository: FineRepository,
    private readonly userRepository: UserRepository,
    private readonly carRepository: CarRepository,
    private readonly transactionRunner: TransactionRunner
  ) {}

  async execute(request: IssueFineRequest) {
    const { reportId, ownerId, plateNumber, amount, notes, issuedBy } = request;
    if (!reportId || !ownerId || !plateNumber || !amount || Number(amount) <= 0 || !issuedBy) {
      throw new DomainError('INVALID_ARGUMENT', 'reportId, ownerId, plateNumber, valid amount, and issuedBy are required');
    }

    const normalizedPlate = normalizePlate(plateNumber);
    if (!normalizedPlate) {
      throw new DomainError('INVALID_ARGUMENT', 'Invalid plateNumber');
    }

    return this.transactionRunner.run(async (tx) => {
      const caller = await this.userRepository.getById(issuedBy, tx);
      if (!caller || caller.role !== 'police') {
        throw new DomainError('PERMISSION_DENIED', 'Only police officers can issue fines');
      }

      const report = await this.reportRepository.getById(reportId, tx);
      if (!report) {
        throw new DomainError('NOT_FOUND', 'Report not found');
      }

      const car = await this.carRepository.getByPlateNumber(plateNumber, tx);
      if (!car) {
        throw new DomainError('NOT_FOUND', 'Vehicle not found for fine issuance');
      }
      if (car.ownerId !== ownerId) {
        throw new DomainError('FAILED_PRECONDITION', 'Vehicle ownership has changed; fine ownerId does not match current owner');
      }
      if (car.status === 'archived') {
        throw new DomainError('FAILED_PRECONDITION', 'Cannot issue fine for an archived vehicle');
      }

      await this.reportRepository.updateStatus(reportId, 'investigated', tx);

      const fine: Omit<Fine, 'id'> = {
        reportId,
        ownerId,
        plateNumber: String(plateNumber).toUpperCase().trim(),
        plateNumberNormalized: normalizedPlate,
        amount: Number(amount),
        status: 'unpaid',
        notes: notes ?? '',
        issuedBy,
        issuedAt: new Date(),
      };

      const fineId = await this.fineRepository.create(fine, tx);
      return { ok: true, fineId };
    });
  }
}
