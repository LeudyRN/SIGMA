import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from './page';

describe('Home', () => {
  it('presents the SIGMA purpose and institution', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /sistema de gestión e inscripción virtual de tesis y monográficos/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/UCOTESIS/i).length).toBeGreaterThan(0);
  });
});
