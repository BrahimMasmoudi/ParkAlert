import { describe, expect, it, vi } from 'vitest';
import type { Fine } from '../app/stores/fines';
import {
  ReceiptPdfRenderError,
  buildReceiptCopy,
  buildReceiptDocDefinition,
  buildReceiptViewModel,
  detectTextDirection,
  downloadReceiptPdf,
  isPdfVectorSafeText,
  loadPdfMake,
  resolvePdfMakeExport,
  resolveReceiptLocale,
  resolveVfsExport,
  sanitizeFilenameSegment,
  sanitizeReceiptText,
} from '../app/utils/receiptPdf';

function makePaidFine(overrides: Partial<Fine> = {}): Fine {
  return {
    id: 'fine-abc123def456',
    reportId: 'rep-1',
    ownerId: 'owner-1',
    plateNumber: '123 TU 4567',
    amount: 120,
    status: 'paid',
    issuedAt: Date.UTC(2026, 10, 20, 9, 15),
    paidAt: Date.UTC(2026, 10, 24, 14, 30),
    paymentReference: 'PA-20261124-AABBCC',
    paymentProvider: 'simulated',
    notes: 'Double parking',
    ...overrides,
  };
}

describe('receiptPdf utilities', () => {
  it('resolves receipt locale to fr or en with ar fallback to en', () => {
    expect(resolveReceiptLocale('fr')).toBe('fr');
    expect(resolveReceiptLocale('en')).toBe('en');
    expect(resolveReceiptLocale('ar')).toBe('en');
    expect(resolveReceiptLocale('es')).toBe('en');
  });

  it('builds complete non-empty EN and FR receipt copy dictionaries', () => {
    const enCopy = buildReceiptCopy('en');
    const frCopy = buildReceiptCopy('fr');

    for (const [key, value] of Object.entries(enCopy)) {
      expect(typeof value, `en.${key} type`).toBe('string');
      expect(value, `en.${key}`).toBeTruthy();
      expect(typeof (frCopy as Record<string, string>)[key], `fr.${key} type`).toBe('string');
      expect((frCopy as Record<string, string>)[key], `fr.${key}`).toBeTruthy();
    }
    expect(enCopy.paidBadge).toBe('PAID');
    expect(frCopy.paidBadge).toBe('PAYÉE');
  });

  it('strips BiDi formatting and C0/C1 controls while preserving Arabic script', () => {
    expect(sanitizeReceiptText('\u202Eأميرة\u200F بن\u2066 صالح\u2069\u0007\u0085')).toBe('أميرة بن صالح');
    expect(sanitizeReceiptText('   \u202E\u200E   ')).toBe('—');
    expect(sanitizeReceiptText(null)).toBe('—');
  });

  it('distinguishes vector-safe ASCII/Latin-1 text from Arabic, extended Unicode, and C1 controls', () => {
    expect(isPdfVectorSafeText('Amira Ben Salah')).toBe(true);
    expect(isPdfVectorSafeText('Café Éléonore — ••••')).toBe(true);
    expect(isPdfVectorSafeText('L’œil 10€')).toBe(false);
    expect(isPdfVectorSafeText('أميرة بن صالح')).toBe(false);
    expect(isPdfVectorSafeText('bad\u0085ctrl')).toBe(false);
  });

  it('detects text direction for Arabic vs Latin strings', () => {
    expect(detectTextDirection('أميرة بن صالح')).toBe('rtl');
    expect(detectTextDirection('Amira Ben Salah')).toBe('ltr');
  });

  it('builds normalized receipt view-model with UTC timestamps and optional police PII omission', () => {
    const ownerView = buildReceiptViewModel(
      makePaidFine(),
      { cardholderName: 'Amira Ben Salah', cardBrand: 'amex', cardLast4: '4242' },
      'ar',
    );

    expect(ownerView.locale).toBe('en');
    expect(ownerView.fineReference).toBe('#DEF456');
    expect(ownerView.issuedAtFormatted).toBe('2026-11-20 09:15 UTC');
    expect(ownerView.paidAtFormatted).toBe('2026-11-24 14:30 UTC');
    expect(ownerView.amountFormatted).toBe('TND 120.00');
    expect(ownerView.paymentProviderLabel).toBe('Simulated Card Payment');
    expect(ownerView.rows.map(r => r.key)).toEqual([
      'fineReference',
      'fineId',
      'plateNumber',
      'issuedAt',
      'paidAt',
      'paymentChannel',
      'notes',
    ]);
    expect(ownerView.cardSummary).toEqual({
      cardholderName: 'Amira Ben Salah',
      cardBrand: 'amex',
      cardBrandLabel: 'American Express',
      cardLast4: '4242',
    });

    const policeView = buildReceiptViewModel(
      makePaidFine({ paidAt: Number.NaN, notes: '   \u200E  ' }),
      null,
      'fr',
    );

    expect(policeView.locale).toBe('fr');
    expect(policeView.paidAtFormatted).toBe('—');
    expect(policeView.rows.some(r => r.key === 'notes')).toBe(false);
    expect(policeView.cardSummary).toBeUndefined();
  });

  it('builds docDefinition with vector Latin text without invoking Canvas adapter', async () => {
    const canvasAdapter = vi.fn();
    const vm = buildReceiptViewModel(
      makePaidFine(),
      { cardholderName: 'Amira Ben Salah', cardBrand: 'visa', cardLast4: '1111' },
      'en',
    );

    const doc = await buildReceiptDocDefinition(vm, canvasAdapter);
    expect(canvasAdapter).not.toHaveBeenCalled();

    const json = JSON.stringify(doc);
    expect(json).toContain('ParkAlert');
    expect(json).toContain('PA-20261124-AABBCC');
    expect(json).toContain('Amira Ben Salah');
    expect(json).toContain('Double parking');
  });

  it('uses Canvas adapter for Arabic cardholderName and extended/Arabic notes', async () => {
    const canvasAdapter = vi.fn(async (text: string) => ({
      dataUrl: `data:image/png;base64,MOCK_${Buffer.from(text).toString('hex')}`,
      width: 140,
      height: 18,
    }));

    const vm = buildReceiptViewModel(
      makePaidFine({ notes: 'مخالفة وقوف 10€' }),
      { cardholderName: 'أميرة بن صالح', cardBrand: 'mastercard', cardLast4: '9999' },
      'en',
    );

    const doc = await buildReceiptDocDefinition(vm, canvasAdapter);
    expect(canvasAdapter).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(doc)).toContain('data:image/png;base64,MOCK_');
  });

  it('throws ReceiptPdfRenderError when Canvas adapter returns null for non-vector text', async () => {
    const vm = buildReceiptViewModel(
      makePaidFine(),
      { cardholderName: 'أميرة بن صالح', cardBrand: 'visa', cardLast4: '4242' },
      'en',
    );

    await expect(buildReceiptDocDefinition(vm, async () => null)).rejects.toBeInstanceOf(
      ReceiptPdfRenderError,
    );
  });

  it('omits card section in docDefinition when cardSummary is null', async () => {
    const vm = buildReceiptViewModel(makePaidFine(), null, 'en');
    const doc = await buildReceiptDocDefinition(vm);
    const json = JSON.stringify(doc);

    expect(json).not.toContain('Payment Method Summary');
    expect(json).not.toContain('••••');
  });

  it('sanitizes filenames and awaits pdfMake download', async () => {
    expect(sanitizeFilenameSegment('PA-20261124-AA/..BB')).toBe('PA-20261124-AABB');
    expect(sanitizeFilenameSegment('—')).toBe('receipt');

    const downloadMock = vi.fn(async () => undefined);
    const createPdfMock = vi.fn(() => ({ download: downloadMock }));
    const vm = buildReceiptViewModel(makePaidFine(), null, 'en');

    await downloadReceiptPdf({ createPdf: createPdfMock }, vm);

    expect(createPdfMock).toHaveBeenCalledTimes(1);
    expect(downloadMock).toHaveBeenCalledWith('parkalert-receipt-PA-20261124-AABBCC.pdf');
  });

  it('unwraps nested default exports for Vite CJS-in-ESM bundles and compiles valid PDF bytes', async () => {
    const innerPdfMake = { createPdf: vi.fn(() => ({ download: vi.fn() })) };
    expect(resolvePdfMakeExport({ default: { __esModule: true, default: innerPdfMake } })).toBe(innerPdfMake);

    const vfsStub = { 'Roboto-Regular.ttf': 'BASE64DATA' };
    expect(resolveVfsExport({ default: { default: vfsStub } })).toEqual(vfsStub);

    const pdfMake = await loadPdfMake();
    const vm = buildReceiptViewModel(
      makePaidFine(),
      { cardholderName: 'Amira Ben Salah', cardBrand: 'visa', cardLast4: '4242' },
      'en',
    );
    const docDef = await buildReceiptDocDefinition(vm);
    const created = pdfMake.createPdf(docDef) as { getBlob?: () => Promise<Blob> };
    const blob = await created.getBlob?.();

    expect(blob).toBeDefined();
    const header = await blob!.slice(0, 5).text();
    expect(header).toBe('%PDF-');
  });
});
