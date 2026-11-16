import { describe, expect, it } from 'vitest';
import en from '../i18n/locales/en.json';
import fr from '../i18n/locales/fr.json';
import ar from '../i18n/locales/ar.json';
import { normalizePlate, useVehicleValidation } from '../app/composables/useVehicleValidation';

function flattenKeys(obj: Record<string, any>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return flattenKeys(v, key);
    }
    return [key];
  });
}

describe('US5: Locale Parity & Plate Normalization', () => {
  it('has identical translation keys across en, fr, and ar including new transfer & rejection keys', () => {
    const enKeys = flattenKeys(en).sort();
    const frKeys = flattenKeys(fr).sort();
    const arKeys = flattenKeys(ar).sort();

    expect(frKeys).toEqual(enKeys);
    expect(arKeys).toEqual(enKeys);

    expect(arKeys).toContain('police.cars.status.transfer_pending_owner');
    expect(arKeys).toContain('police.cars.status.transfer_pending_police');
    expect(arKeys).toContain('police.cars.status.archived');
    expect(arKeys).not.toContain('police.cars.status.transfer_requested');
    expect(arKeys).toContain('owner.modals.add_car.submit_transfer');
    expect(arKeys).toContain('owner.modals.reject_transfer.confirm_button');
  });

  it('normalizes and validates French plates consistently', () => {
    const { isFrenchPlateValid, formatFrenchPlate } = useVehicleValidation();
    expect(normalizePlate('ab-123-cd')).toBe('AB123CD');
    expect(formatFrenchPlate('ab123cd')).toBe('AB-123-CD');
    expect(isFrenchPlateValid('AB-123-CD')).toBe(true);
    expect(isFrenchPlateValid('AB123CD')).toBe(true);
    expect(isFrenchPlateValid('INVALID')).toBe(false);
  });
});
