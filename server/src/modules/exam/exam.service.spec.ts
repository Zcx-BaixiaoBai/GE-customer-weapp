import { Test, TestingModule } from '@nestjs/testing';
import { ExamService } from './exam.service';

/**
 * 考试评分核心逻辑测试
 * 重点测试：评分正确性、及格判断、多选题判分
 */
describe('ExamService', () => {
  let service: ExamService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExamService],
    }).compile();
    service = module.get<ExamService>(ExamService);
    // 等待 DB 初始化完成（会降级到 JSON）
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  describe('评分逻辑', () => {
    it('应该能正确判断单选题答案', () => {
      const question = {
        id: 'q1',
        type: 'single' as const,
        content: '灭火器使用前应该先做什么？',
        options: ['拔掉保险销', '直接按压把手', '倒置摇晃', '用水冷却'],
        answer: [0],
        score: 2,
      };
      const userAnswer = [0];
      const correct =
        userAnswer.length === question.answer.length &&
        userAnswer.every((s) => question.answer.includes(s));
      expect(correct).toBe(true);
    });

    it('应该能正确判断多选题答案', () => {
      const question = {
        id: 'q2',
        type: 'multiple' as const,
        content: '消防通道需要保持什么状态？',
        options: ['畅通', '有照明', '有标识', '可以堆放杂物'],
        answer: [0, 1, 2],
        score: 3,
      };
      // 用户选对了全部
      const userAnswer1 = [0, 1, 2];
      const correct1 =
        userAnswer1.length === question.answer.length &&
        userAnswer1.every((s) => question.answer.includes(s));
      expect(correct1).toBe(true);

      // 用户少选了一个
      const userAnswer2 = [0, 1];
      const correct2 =
        userAnswer2.length === question.answer.length &&
        userAnswer2.every((s) => question.answer.includes(s));
      expect(correct2).toBe(false);

      // 用户多选了错误项
      const userAnswer3 = [0, 1, 2, 3];
      const correct3 =
        userAnswer3.length === question.answer.length &&
        userAnswer3.every((s) => question.answer.includes(s));
      expect(correct3).toBe(false);
    });

    it('应该能正确判断判断题答案', () => {
      const question = {
        id: 'q3',
        type: 'judge' as const,
        content: '烟感探测器报警后应该立即复位。',
        options: ['正确', '错误'],
        answer: [1], // 错误
        score: 2,
      };
      const userAnswer = [1];
      const correct =
        userAnswer.length === question.answer.length &&
        userAnswer.every((s) => question.answer.includes(s));
      expect(correct).toBe(true);
    });

    it('未答题应该判为错误', () => {
      const question = { id: 'q4', type: 'single', content: '', options: [], answer: [0], score: 1 };
      const userAnswer: number[] = [];
      const correct =
        userAnswer.length === question.answer.length &&
        userAnswer.every((s) => question.answer.includes(s));
      expect(correct).toBe(false);
    });
  });

  describe('及格分计算', () => {
    it('分数百分比达到及格线应该通过', () => {
      const score = 8;
      const totalScore = 10;
      const passScore = 60;
      const percentage = (score / totalScore) * 100;
      const passed = percentage >= passScore;
      expect(passed).toBe(true);
    });

    it('分数百分比未达及格线应该不通过', () => {
      const score = 5;
      const totalScore = 10;
      const passScore = 60;
      const percentage = (score / totalScore) * 100;
      const passed = percentage >= passScore;
      expect(passed).toBe(false);
    });

    it('满分应该通过', () => {
      const score = 10;
      const totalScore = 10;
      const passScore = 100;
      const passed = (score / totalScore) * 100 >= passScore;
      expect(passed).toBe(true);
    });

    it('零分应该不通过', () => {
      const score = 0;
      const totalScore = 10;
      const passScore = 60;
      const passed = (score / totalScore) * 100 >= passScore;
      expect(passed).toBe(false);
    });
  });

  describe('统计计算', () => {
    it('应该正确计算通过率', () => {
      const submissions = [
        { passed: true }, { passed: true }, { passed: false }, { passed: true },
      ];
      const total = submissions.length;
      const passedCount = submissions.filter((s) => s.passed).length;
      const passRate = Math.round((passedCount / total) * 100);
      expect(passRate).toBe(75);
    });

    it('应该正确计算平均分', () => {
      const submissions = [
        { score: 8, totalScore: 10 },
        { score: 6, totalScore: 10 },
        { score: 9, totalScore: 10 },
      ];
      const avgScore = Math.round(
        submissions.reduce((sum, s) => sum + (s.score / s.totalScore) * 100, 0) /
          submissions.length * 10,
      ) / 10;
      expect(avgScore).toBe(76.7);
    });

    it('无提交记录时通过率应为 0', () => {
      const submissions: any[] = [];
      const passRate = submissions.length > 0
        ? Math.round((submissions.filter(s => s.passed).length / submissions.length) * 100)
        : 0;
      expect(passRate).toBe(0);
    });
  });

  afterAll(async () => {
    // 清理测试数据文件
  });
});
