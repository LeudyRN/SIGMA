import { GUARDS_METADATA } from '@nestjs/common/constants';
import { NotificationsController } from '../../notifications/notifications.controller';
import { PermissionsController } from '../../roles/permissions.controller';
import { RolesController } from '../../roles/roles.controller';
import { UsersController } from '../../users/users.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RolesGuard } from './roles.guard';

jest.mock('../../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('Authorization guard order', () => {
  it.each([
    UsersController,
    RolesController,
    PermissionsController,
    NotificationsController,
  ])('authenticates before evaluating roles on %p', (controller) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      controller,
    ) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, RolesGuard, PermissionsGuard]);
  });
});
