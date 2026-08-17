import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const adapter = new PrismaMariaDb({
      host: config.get<string>('DATABASE_HOST', 'localhost'),
      port: config.get<number>('DATABASE_PORT', 3306),
      user: config.get<string>('DATABASE_USER', 'sigma_user'),
      password: config.get<string>('DATABASE_PASSWORD', 'sigma_password'),
      database: config.get<string>('DATABASE_NAME', 'sigma_ucotesis'),
      connectionLimit: 10,
    });

    super({ adapter });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
