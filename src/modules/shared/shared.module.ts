import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { HttpThrottlerGuard } from './infrastructure/http/http-throttler.guard.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from './infrastructure/security/auth.module.js';
import { KafkaProducerService } from './infrastructure/messaging/kafka-producer.service.js';
import { HealthController } from './interfaces/http/health.controller.js';
import { TerminusModule } from '@nestjs/terminus';
import { RsqlParser } from './infrastructure/db/rsql-parser.js';

@Module({
  imports: [
    TerminusModule,
    CqrsModule,
    ConfigModule,
    AuthModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const limit = config.get<number>('RMU_THROTTLE_LIMIT')!;
        // Requests per client IP and window; 0 turns the limit off.
        return { throttlers: [{ limit, ttl: config.get<number>('RMU_THROTTLE_TTL_MS')! }], skipIf: () => limit === 0 };
      },
    }),
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: HttpThrottlerGuard }, RsqlParser, KafkaProducerService],
  exports: [RsqlParser, KafkaProducerService],
})
export class SharedModule {}
