import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityDialog } from './entity-dialog';

describe('EntityDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0),
    );
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => window.clearTimeout(handle));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('mantiene el foco y el valor mientras un formulario controlado se vuelve a renderizar', async () => {
    const user = userEvent.setup();

    function FormHarness() {
      const [name, setName] = useState('');

      return (
        <EntityDialog open title="Crear período" onClose={() => undefined}>
          <label>
            Nombre
            <input
              aria-label="Nombre"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        </EntityDialog>
      );
    }

    render(<FormHarness />);

    const input = screen.getByRole('textbox', { name: 'Nombre' });
    await waitFor(() => expect(input).toHaveFocus());

    await user.type(input, 'Período 2026-1');

    expect(input).toHaveValue('Período 2026-1');
    expect(input).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Cerrar' })).not.toHaveFocus();
  });
});
