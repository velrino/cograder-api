import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

async function bootstrap() {
  process.env.TZ = 'America/Sao_Paulo';

  process.env.LAST_DEPLOY = new Date().toISOString();

  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT || 8888;

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('CoGrader API')
    .setDescription('Real-time image processing pipeline API')
    .setVersion('1.0')
    .addTag('jobs', 'Image processing job endpoints')
    .addTag('queue', 'Queue health and monitoring')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Use Scalar for API documentation
  app.use(
    '/docs',
    apiReference({
      spec: {
        content: document,
      },
      theme: 'purple',
    }),
  );

  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Application is running on port ${port}`);
  console.log(
    `📚 API Documentation available at http://localhost:${port}/docs`,
  );
}
bootstrap();
