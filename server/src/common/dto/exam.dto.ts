import { IsString, IsOptional, IsArray, IsNumber, IsNotEmpty, IsIn } from 'class-validator';

/** 创建题目 DTO */
export class CreateQuestionDto {
  @IsOptional()
  @IsString()
  @IsIn(['single', 'multiple', 'judge'])
  type?: string; // single | multiple | judge

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  options?: string[];

  @IsOptional()
  @IsArray()
  answer?: number[];

  @IsOptional()
  @IsNumber()
  score?: number;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

/** 创建考试 DTO */
export class CreateExamDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  questionIds?: string[];

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsNumber()
  passScore?: number;
}

/** 提交考试 DTO */
export class SubmitExamDto {
  @IsString()
  @IsNotEmpty()
  examId: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsArray()
  answers: { questionId: string; selected: number[] }[];

  @IsOptional()
  @IsNumber()
  duration?: number;
}

/** AI 生成题目 DTO */
export class GenerateQuestionsDto {
  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsOptional()
  @IsNumber()
  count?: number;
}
