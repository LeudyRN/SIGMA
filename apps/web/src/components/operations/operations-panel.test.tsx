import { describe, expect, it } from 'vitest';
import { readPath } from './operations-panel';

describe('OperationsPanel table values', () => {
  it('shows a modality name instead of its JSON representation', () => {
    expect(readPath({ modality: { id: '2', name: 'Monográfico' } }, 'modality')).toBe(
      'Monográfico',
    );
  });

  it('summarizes a payment proof in language suitable for users', () => {
    expect(
      readPath(
        {
          proof: {
            status: 'VALIDADO',
            name: 'comprobante.jpg',
            mimeType: 'image/jpeg',
          },
        },
        'proof',
      ),
    ).toBe('Validado · comprobante.jpg');
  });
});
