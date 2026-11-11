import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './modules/shared/infrastructure/security/auth.module.js';
import { envSchema } from './config/env.schema.js';
import { SharedModule } from './modules/shared/shared.module.js';
import { StatsModule } from './modules/stats/stats.module.js';
import { ImagesModule } from './modules/images/images.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envSchema,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('RMU_MONGO_MEDIA_URI'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    SharedModule,
    StatsModule,
    ImagesModule,
  ],
})
export class AppModule {}
