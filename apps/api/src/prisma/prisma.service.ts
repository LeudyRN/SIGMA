import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    const databaseUrl = new URL(config.getOrThrow<string>('DATABASE_URL'));
    databaseUrl.searchParams.set('charset', 'utf8mb4');
    const adapter = new PrismaMariaDb(databaseUrl.toString());

    super({ adapter });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
