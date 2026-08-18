import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
  it('requires a valid employee code and role', async () => {
    const dto = Object.assign(new CreateUserDto(), {
      employeeCode: '',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@uasd.edu.do',
      password: 'contrasena-segura',
      roleIds: [],
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['employeeCode']),
    );
  });
});
