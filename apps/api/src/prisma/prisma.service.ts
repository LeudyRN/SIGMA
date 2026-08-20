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
      user: config.getOrThrow<string>('DATABASE_USER'),
      password: config.getOrThrow<string>('DATABASE_PASSWORD'),
      database: config.getOrThrow<string>('DATABASE_NAME'),
      connectionLimit: 10,
    });

    super({ adapter });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
