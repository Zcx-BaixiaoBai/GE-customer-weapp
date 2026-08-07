import { IsString, IsOptional, IsArray, IsNumber, IsBoolean } from 'class-validator';

/** 报修文字分析 DTO */
export class AnalyzeTextDto {
  @IsOptional()
  @IsString()
  supplementText?: string;

  @IsOptional()
  @IsString()
  accumulatedText?: string;
}

/** 报修工单提交 DTO */
export class SubmitRepairDto {
  @IsString()
  issue: string;

  @IsString()
  location: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  photoUrls?: string[];

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}
