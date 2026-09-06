import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCatalogDto } from './ucotesis.dto';

describe('CreateCatalogDto', () => {
  it('normalizes a human-readable catalog code before validation', async () => {
    const dto = plainToInstance(CreateCatalogDto, {
      codigo: ' Curso monográfico ',
      nombre: 'Curso monográfico',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.codigo).toBe('CURSO_MONOGRAFICO');
  });

  it('returns a user-facing message for unsupported characters', async () => {
    const dto = plainToInstance(CreateCatalogDto, {
      codigo: 'TESIS/ESPECIAL',
      nombre: 'Tesis especial',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints?.matches).toBe(
      'El código debe contener entre 2 y 60 letras, números, guiones o guiones bajos.',
    );
  });
});
