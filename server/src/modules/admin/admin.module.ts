import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { TrainingModule } from '../training/training.module';
import { ExamModule } from '../exam/exam.module';

@Module({
  imports: [TrainingModule, ExamModule],
  controllers: [AdminController],
})
export class AdminModule {}
