import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { UploadModule } from './modules/upload/upload.module';
import { RepairModule } from './modules/repair/repair.module';

@Module({
  imports: [AuthModule, UploadModule, RepairModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
