import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as tencentcloud from 'tencentcloud-sdk-nodejs';
import { config } from '../../config/configuration';

const AsrClient = tencentcloud.asr.v20190614.Client;

export interface RepairAnalysisResult {
  transcribedText: string;
  issue: string;
  location: string;
  type: string;
  isComplete: boolean;
  question: string;
}

// 三字段拆分的 LLM Prompt（与小程序端完全一致）
const SYSTEM_PROMPT = `你是金鹰世界商场的报修信息提取助手。你的任务是把用户描述拆分为三个字段，并检查每个字段是否完整。

三个字段：
1. issue：报修内容——具体什么问题（如"空调不制冷""地面有积水""电梯故障"）
2. location：报修地点——具体位置（如"4楼办公室""3楼走廊B区""地下停车场入口"）
3. type：报修类型——根据内容自动判断，只有两种取值：
   - "物业维修"：设备损坏、设施故障、空调/电梯/照明/门窗/水管等硬件问题
   - "品质管理"：脏污、异物、积水、卫生、环境品质等软性问题

完整性判断规则：
- issue有值且能描述出具体问题 → issueOk=true
- location有值且包含楼层或区域信息 → locationOk=true
- 两个字段都OK → isComplete=true
- 任一字段缺失 → isComplete=false

追问规则（必须严格遵守）：
- 只追问值为空的字段，已提取到内容的字段绝不重复追问
- 缺issue → question="请描述一下具体是什么问题"
- 缺location → question="请说一下具体在哪个楼层哪个区域"
- 两个都缺 → 只追问issue（先搞清问题是什么）
- question只包含一句话，口语化

返回JSON格式：
{"issue":"提取到的报修内容，没有则填空字符串","location":"提取到的报修地点，没有则填空字符串","type":"物业维修或品质管理","isComplete":true或false,"question":"缺失字段的追问语，齐全时为空字符串"}

示例：
用户说"4楼办公室空调不制冷" → {"issue":"空调不制冷","location":"4楼办公室","type":"物业维修","isComplete":true,"question":""}
用户说"空调坏了" → {"issue":"空调故障","location":"","type":"物业维修","isComplete":false,"question":"请说一下具体在哪个楼层哪个区域"}
用户说"3楼走廊地面有积水" → {"issue":"地面有积水","location":"3楼走廊","type":"品质管理","isComplete":true,"question":""}
用户说"地面很脏" → {"issue":"地面脏污","location":"","type":"品质管理","isComplete":false,"question":"请说一下具体在哪个楼层哪个区域"}
用户说"在4楼" → {"issue":"","location":"4楼","type":"物业维修","isComplete":false,"question":"请描述一下具体是什么问题"}`;

@Injectable()
export class RepairService {
  private readonly logger = new Logger(RepairService.name);
  private asrClient: any;

  constructor() {
    if (config.tencentCloud.secretId && config.tencentCloud.secretKey) {
      this.asrClient = new AsrClient({
        credential: {
          secretId: config.tencentCloud.secretId,
          secretKey: config.tencentCloud.secretKey,
        },
        region: 'ap-shanghai',
        profile: {
          httpProfile: {
            endpoint: 'asr.tencentcloudapi.com',
          },
        },
      });
    }
  }

  // 一句话语音识别
  async speechToText(audioBase64: string, audioFormat: string): Promise<string> {
    if (!this.asrClient) {
      throw new Error('腾讯云ASR未配置，请在.env中设置TENCENT_CLOUD_SECRET_ID和TENCENT_CLOUD_SECRET_KEY');
    }

    const params = {
      EngSerViceType: '16k_zh',
      SourceType: 1,
      VoiceFormat: audioFormat || 'mp3',
      Data: audioBase64,
      FilterDirty: 0,
      FilterModal: 0,
      FilterPunc: 0,
      ConvertNumMode: 1,
    };

    const result = await this.asrClient.SentenceRecognition(params);
    this.logger.log(`ASR结果: ${result.Result}, 时长: ${result.AudioDuration}ms`);
    return result.Result;
  }

  // LLM三字段校验（通用OpenAI兼容接口）
  async checkAndExtractFields(text: string): Promise<{ issue: string; location: string; type: string; isComplete: boolean; question: string }> {
    // 优先用独立LLM配置（直连，不走RAG，快）
    // fallback到FastGPT（走RAG，慢但可用）
    let apiUrl = '';
    let apiKey = '';
    let model = '';
    let maxTokens = 500;
    let temperature = 0.1;
    let timeout = 20000;

    if (config.llm.apiKey && config.llm.baseUrl) {
      apiUrl = config.llm.baseUrl + '/chat/completions';
      apiKey = config.llm.apiKey;
      model = config.llm.model;
      maxTokens = config.llm.maxTokens;
      temperature = config.llm.temperature;
      timeout = config.llm.timeout;
    } else if (config.fastgpt.apiKey) {
      apiUrl = config.fastgpt.baseUrl + '/chat/completions';
      apiKey = config.fastgpt.apiKey;
    } else {
      // 没配LLM，直接返回原文当完整
      return { issue: text, location: '', type: '物业维修', isComplete: true, question: '' };
    }

    try {
      const requestBody: any = {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        stream: false,
        detail: false,
      };
      // 独立LLM配置时才传model/maxTokens/temperature（FastGPT不认这些参数）
      if (config.llm.apiKey && config.llm.baseUrl) {
        if (model) requestBody.model = model;
        requestBody.max_tokens = maxTokens;
        requestBody.temperature = temperature;
      }

      const response = await axios.post(apiUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout,
      });

      const content = response.data.choices[0].message.content;
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (e) {
          this.logger.warn('LLM返回JSON解析失败，用原文: ' + content.substring(0, 100));
        }
      }
    } catch (err) {
      this.logger.warn('LLM请求失败，用原文: ' + err.message);
    }

    // 降级：LLM失败就用原文当完整
    return { issue: text, location: '', type: '物业维修', isComplete: true, question: '' };
  }

  // 一步到位：ASR + LLM（合并调用，省掉一次小程序↔NestJS往返）
  async analyzeRepairRequest(params: {
    audioBase64?: string;
    audioFormat?: string;
    supplementText?: string;
    accumulatedText?: string;  // 多轮语音累计上下文
  }): Promise<RepairAnalysisResult> {
    let transcribedText = '';

    // Step 1: 语音转文字
    if (params.audioBase64) {
      transcribedText = await this.speechToText(params.audioBase64, params.audioFormat || 'mp3');
    }

    // 合并补充文字
    if (params.supplementText) {
      transcribedText = `${transcribedText} ${params.supplementText}`.trim();
    }

    // 合并多轮累计上下文
    let fullText = transcribedText;
    if (params.accumulatedText) {
      fullText = params.accumulatedText + '。' + transcribedText;
    }

    if (!fullText) {
      return {
        transcribedText: '',
        issue: '',
        location: '',
        type: '',
        isComplete: false,
        question: '请描述报修问题',
      };
    }

    // Step 2: LLM校验（直接在NestJS做，不回小程序中转）
    const llmResult = await this.checkAndExtractFields(fullText);

    return {
      transcribedText: fullText,
      issue: llmResult.issue || '',
      location: llmResult.location || '',
      type: llmResult.type || '物业维修',
      isComplete: llmResult.isComplete,
      question: llmResult.question || '',
    };
  }
}
