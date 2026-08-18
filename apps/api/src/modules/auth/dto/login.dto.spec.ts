import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  it('accepts a short existing password during authentication', async () => {
    const dto = Object.assign(new LoginDto(), {
      identificador: '999999999',
      password: 'abcde',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects missing credentials', async () => {
    const dto = Object.assign(new LoginDto(), {
      identificador: '',
      password: '',
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['identificador', 'password']),
    );
  });
});
