import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './modules/shared/infrastructure/security/auth.module';
import { envSchema } from './config/env.schema';
import { SharedModule } from './modules/shared/shared.module';
import { ImagesModule } from './modules/images/images.module';

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
    ImagesModule,
  ],
})
export class AppModule {}
