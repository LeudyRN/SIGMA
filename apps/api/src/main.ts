import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  const port = config.get<number>('API_PORT', 3001);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: [corsOrigin],
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SIGMA API')
    .setDescription(
      'API de gestión e inscripción de tesis y monográficos de UCOTESIS',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('sigma_access_token')
    .addCookieAuth('sigma_refresh_token')
    .build();

  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
    {
      customSiteTitle: 'SIGMA API Docs',
    },
  );

  await app.listen(port);
}

void bootstrap();
