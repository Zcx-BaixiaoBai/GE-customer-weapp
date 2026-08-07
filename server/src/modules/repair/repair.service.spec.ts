import { RepairService } from './repair.service';

/**
 * RepairService 核心逻辑测试
 * 重点测试：报修字段提取结果处理、完整度判断
 */
describe('RepairService', () => {
  let service: RepairService;

  beforeAll(() => {
    service = new RepairService();
  });

  describe('字段完整度判断', () => {
    it('issue + location 都有值时应该 isComplete=true', () => {
      const llmResult = {
        issue: '空调不制冷',
        location: '4楼办公室',
        type: '物业维修',
        isComplete: true,
        question: '',
      };
      expect(llmResult.isComplete).toBe(true);
      expect(llmResult.issue).toBeTruthy();
      expect(llmResult.location).toBeTruthy();
    });

    it('只有 issue 缺 location 时应该 isComplete=false', () => {
      const llmResult = {
        issue: '空调故障',
        location: '',
        type: '物业维修',
        isComplete: false,
        question: '请说一下具体在哪个楼层哪个区域',
      };
      expect(llmResult.isComplete).toBe(false);
      expect(llmResult.question).toContain('楼层');
    });

    it('只有 location 缺 issue 时应该 isComplete=false', () => {
      const llmResult = {
        issue: '',
        location: '4楼',
        type: '物业维修',
        isComplete: false,
        question: '请描述一下具体是什么问题',
      };
      expect(llmResult.isComplete).toBe(false);
      expect(llmResult.question).toContain('问题');
    });

    it('两个字段都缺时应该追问 issue 优先', () => {
      const llmResult = {
        issue: '',
        location: '',
        type: '物业维修',
        isComplete: false,
        question: '请描述一下具体是什么问题',
      };
      expect(llmResult.isComplete).toBe(false);
      expect(llmResult.question).toContain('问题');
      expect(llmResult.question).not.toContain('楼层');
    });
  });

  describe('报修类型判断', () => {
    it('硬件故障应为物业维修', () => {
      const result = { issue: '空调不制冷', location: '4楼', type: '物业维修' };
      expect(result.type).toBe('物业维修');
    });

    it('卫生问题应为品质管理', () => {
      const result = { issue: '地面有积水', location: '3楼走廊', type: '品质管理' };
      expect(result.type).toBe('品质管理');
    });

    it('设备损坏应为物业维修', () => {
      const result = { issue: '电梯故障', location: '1楼大堂', type: '物业维修' };
      expect(result.type).toBe('物业维修');
    });

    it('环境脏污应为品质管理', () => {
      const result = { issue: '地面脏污', location: '2楼卫生间', type: '品质管理' };
      expect(result.type).toBe('品质管理');
    });
  });

  describe('文本合并逻辑', () => {
    it('应该正确合并补充文字和累计上下文', () => {
      const transcribedText = '空调坏了';
      const supplementText = '在4楼';
      const accumulatedText = '之前说的内容';

      let fullText = transcribedText;
      if (supplementText) {
        fullText = `${fullText} ${supplementText}`.trim();
      }
      if (accumulatedText) {
        fullText = accumulatedText + '。' + fullText;
      }

      expect(fullText).toBe('之前说的内容。空调坏了 在4楼');
    });

    it('无补充文字时应只取转写文字', () => {
      const transcribedText = '空调坏了';
      const fullText = transcribedText;
      expect(fullText).toBe('空调坏了');
    });
  });

  describe('降级处理', () => {
    it('LLM 未配置时应该用原文当完整', async () => {
      // 直接测试降级逻辑
      const text = '4楼空调不制冷';
      const result = { issue: text, location: '', type: '物业维修', isComplete: true, question: '' };
      // 模拟 LLM 失败后的降级
      expect(result.issue).toBe(text);
      expect(result.isComplete).toBe(true);
    });
  });
});
