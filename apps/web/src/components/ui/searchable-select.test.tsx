import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SearchableSelect } from './searchable-select';

function ControlledSelect({ onSearch }: { onSearch: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <SearchableSelect
      label="Estudiante"
      value={value}
      onChange={setValue}
      onSearchChange={onSearch}
      options={[
        {
          value: '1',
          label: '100576672 · Leudy Randy Nolasco',
          searchText: '100576672 Leudy Randy Nolasco',
        },
        {
          value: '2',
          label: '100000002 · María Pérez',
          searchText: '100000002 María Pérez',
        },
      ]}
    />
  );
}

describe('SearchableSelect', () => {
  it('busca por matrícula y conserva la opción seleccionada', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<ControlledSelect onSearch={onSearch} />);

    const input = screen.getByRole('combobox', { name: 'Estudiante' });
    await user.click(input);
    await user.type(input, '100576672');
    await user.click(screen.getByRole('option', { name: /Leudy Randy Nolasco/ }));

    expect(onSearch).toHaveBeenLastCalledWith('100576672');
    expect(input).toHaveValue('100576672 · Leudy Randy Nolasco');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('ignora acentos al filtrar por nombre', async () => {
    const user = userEvent.setup();
    render(<ControlledSelect onSearch={vi.fn()} />);

    const input = screen.getByRole('combobox', { name: 'Estudiante' });
    await user.click(input);
    await user.type(input, 'Maria');

    expect(screen.getByRole('option', { name: /María Pérez/ })).toBeVisible();
  });
});
