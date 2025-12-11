import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(express.json());

  app.use(express.urlencoded({ extended: true }));

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  if (process.env.HOST) {
    await app.listen(process.env.PORT || 5000, process.env.HOST);
  } else {
    await app.listen(5000);
  }
}
bootstrap();
