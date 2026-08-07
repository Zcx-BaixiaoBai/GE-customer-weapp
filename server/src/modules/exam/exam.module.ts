import { Module } from '@nestjs/common';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';
import { CertificateService } from './certificate.service';

@Module({
  controllers: [ExamController],
  providers: [ExamService, CertificateService],
  exports: [ExamService, CertificateService],
})
export class ExamModule {}
