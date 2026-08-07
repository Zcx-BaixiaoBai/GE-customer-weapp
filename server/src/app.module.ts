import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UploadModule } from './modules/upload/upload.module';
import { RepairModule } from './modules/repair/repair.module';
import { TrainingModule } from './modules/training/training.module';
import { ExamModule } from './modules/exam/exam.module';
import { AdminModule } from './modules/admin/admin.module';
import { DatabaseService } from './database/database.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    AuthModule,
    UploadModule,
    RepairModule,
    TrainingModule,
    ExamModule,
    AdminModule,
  ],
  controllers: [],
  providers: [
    DatabaseService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
