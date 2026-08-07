import { IsString, IsOptional, IsNumber, IsArray, IsNotEmpty } from 'class-validator';

/** 创建课程 DTO */
export class CreateCourseDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  lessons?: any[];
}

/** 添加课时 DTO */
export class AddLessonDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  type?: string; // video | article

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;
}

/** 更新进度 DTO */
export class UpdateProgressDto {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsNotEmpty()
  lessonId: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsNumber()
  progress?: number;

  @IsOptional()
  @IsNumber()
  watchedDuration?: number;
}

/** AI 培训助手 DTO */
export class AiAssistantDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsString()
  courseTitle?: string;

  @IsOptional()
  @IsString()
  courseDescription?: string;

  @IsOptional()
  @IsString()
  lessonContent?: string;
}
