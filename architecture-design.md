# 金鹰世界商场物业小程序 — 整体架构设计方案

> 版本：v2.0 | 日期：2026-07-17 | 编制：微信小程序开发工程师
> v2.0 变更：引入 Zvec 向量库 + AgentScope RAG + Unstructured 文档解析 + FunASR 语音识别 + cloudbase-agent-ui 小程序对话组件

---

## 一、项目概述

### 1.1 项目定位
金鹰世界商场物业小程序，面向商场租户/顾客提供两大核心服务：
1. **AI知识库问答系统** — 商场运营知识、物业规则、入驻指南等智能问答
2. **智能报修功能** — 拍照+语音描述，AI自动填写工单表单

### 1.2 核心目标
- 快速上线（MVP 4-6周）
- 微信生态深度集成（登录、支付、订阅消息）
- 主包体积 < 1.5MB，启动 < 1.5s
- 首次审核通过率 90%+

---

## 二、整体架构分层

### 2.1 三端架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  微信小程序   │  │  Web后台管理  │  │  现有工单系统  │       │
│  │  (C端用户)    │  │  (运营人员)   │  │  (已有服务)   │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼──────────────┐
│         ▼                  ▼                  ▼              │
│                     API网关层                                 │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  Nginx 反向代理 + HTTPS + 限流 + CORS              │     │
│  └──────────────────────┬──────────────────────────────┘     │
│                         │                                     │
│                    后端服务层                                 │
│  ┌─────────┬─────────┬──────────┬──────────┬──────────┐     │
│  │ 用户服务 │ AI问答  │ 报修服务  │ 文档处理  │ 后台管理  │     │
│  │ Service │ Service │ Service  │ Service  │ Service  │     │
│  └────┬────┴────┬────┴────┬─────┴────┬─────┴────┬─────┘     │
│       │         │         │          │          │            │
│       ▼         ▼         ▼          ▼          ▼            │
│                    数据与基础设施层                           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │MySQL │ │Redis │ │向量DB│ │MinIO │ │消息队列│ │ES    │     │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 技术选型

| 层级 | 技术 | 选型理由 |
|------|------|----------|
| 小程序端 | 原生 WXML/WXSS/JS + TDesign + **cloudbase-agent-ui** | 性能最优、包体最小、对话UI开箱即用 |
| Web后台 | React + Ant Design Pro | 成熟后台方案、组件丰富 |
| 后端框架 | Node.js (NestJS) | TypeScript全栈统一、AI生态友好 |
| RAG引擎 | **AgentScope** (Python微服务) | 内置Reader/Knowledge/Store，开箱即用 |
| 向量数据库 | **Zvec** (进程内嵌入) | 零运维、8000+QPS、混合查询、Node.js SDK |
| 文档解析 | **Unstructured** (Python库) | 64+格式、表格提取、OCR、chunking |
| 数据库 | MySQL 8.0 | 事务一致性、成熟稳定 |
| 缓存 | Redis 7 | 会话管理、热数据缓存、限流 |
| 对象存储 | MinIO (自建) / 腾讯云COS | 文档/图片存储 |
| 消息队列 | RabbitMQ | 文档处理异步任务 |
| LLM | 通义千问/文心一言 (私有部署) | 中文理解强、合规可控 |
| ASR | **FunASR** (阿里开源) | 中文CER比Whisper低2.7倍、CPU可跑、含情感/说话人 |
| 搜索引擎 | ~~Elasticsearch~~ → **Zvec FTSQuery** | Zvec v0.5.0内置全文检索，无需独立ES |

### 2.3 开源项目集成矩阵

> **v3.0 核心决策：知识库问答全部交给 FastGPT，NestJS 不再自建 RAG。**

以下是对架构各模块可借用的开源项目的系统梳理：

#### 2.3.1 AI知识库问答模块

| 子模块 | 自建工作量 | 推荐开源项目 | 借用方式 | 省掉的工作 |
|--------|-----------|-------------|----------|-----------|
| 文档解析(PDF/Word/Excel/PPT) | 2-3周 | **Unstructured** (`unstructured[all-docs]`) | Python库直接调用，输出结构化JSON元素 | pdf-parse/mammoth/xlsx拼装 + 表格结构识别 + OCR |
| 文档分段(chunking) | 1-2周 | **Unstructured** chunking模块 | `by_title`/`by_similarity`策略内置 | 自研分段策略 + overlap逻辑 |
| RAG检索引擎 | 2-3周 | **AgentScope** RAG模块 | Python微服务，NestJS通过HTTP调用 | Reader+Knowledge+Store三层自研 |
| 向量检索+全文+标量过滤 | 1-2周 | **Zvec** MultiQuery | `npm install @zvec/zvec` 嵌入NestJS | Milvus + ES双系统部署运维 |
| 对话UI(气泡/流式/来源引用) | 1周 | **cloudbase-agent-ui** | 小程序组件直接引入，配置即用 | 聊天气泡+流式渲染+历史记录自研 |
| 后台知识库管理 | 2-3周 | **RAGFlow** 或 **FastGPT** | 部署为独立服务，后台嵌入iframe | 文档管理+分段预览+处理状态全流程 |

**Unstructured 文档解析关键代码：**
```python
# pip install "unstructured[all-docs]"
from unstructured.partition.auto import partition

# 自动识别格式：PDF/Word/Excel/PPT/HTML/图片
elements = partition(filename="商场运营手册.pdf", strategy="hi_res")
# 输出20+元素类型：NarrativeText/Title/Table/ListItem/Image...
# 每个元素带 metadata：页码、坐标、文件类型、父级章节

# 表格提取为HTML（保持行列结构）
from unstructured.partition.pdf import partition_pdf
elements = partition_pdf(
    filename="入驻指南.pdf",
    strategy="hi_res",
    infer_table_structure=True,  # 表格→HTML
    extract_image_block_types=["Image"],  # 图片提取
)
```

**Zvec 混合查询关键代码（嵌入NestJS）：**
```javascript
// npm install @zvec/zvec
import { createCollection, MultiQuery, VectorQuery, FTSQuery, FusionType } from '@zvec/zvec';

// 一次查询：向量语义 + 全文关键词 + 标量过滤
const results = await collection.query(
  new MultiQuery({
    queries: [
      new VectorQuery('embedding', queryEmbedding, 0.7),    // 语义匹配 70%
      new FTSQuery('content', '空调故障', 0.3),              // 关键词匹配 30%
    ],
    filter: "dataset = 'default' AND created_at > '2026-01-01'",
    fusion: FusionType.RRF,  // Reciprocal Rank Fusion 融合排序
  }),
  { topk: 10 }
);
```

#### 2.3.2 智能报修模块

| 子模块 | 自建工作量 | 推荐开源项目 | 借用方式 | 省掉的工作 |
|--------|-----------|-------------|----------|-----------|
| 语音转文字(ASR) | 1-2周 | **FunASR** (`SenseVoiceSmall`) | `pip install funasr`，funasr-server起OpenAI兼容API | Whisper部署调优 + 标点恢复 + VAD |
| 语音情感识别(可选) | 1周 | **FunASR** (`emotion2vec+large`) | 同一pipeline一次调用 | 独立情感分析模型 |
| 信息完整性校验 | - | 通义千问 qwen-max API | LLM检查必填字段是否齐全，缺失则追问 | 无需自建 |
| 语义分析+字段映射 | - | ~~通义千问 qwen-max API~~ | ~~不再做~~ | ~~移除VLM图片理解~~ |
| 录音UI组件 | 3天 | **cloudbase-agent-ui** 语音模块 | 小程序组件内置录音能力 | 录音波形+权限处理自研 |

**FunASR 关键代码（报修语音识别）：**
```python
# pip install funasr
from funasr import AutoModel

# 一站式：VAD + 识别 + 标点 + 情感
model = AutoModel(
    model="iic/SenseVoiceSmall",     # 中文最优，170倍实时
    vad_model="fsmn-vad",            # 语音端点检测
    punc_model="ct-punc",            # 自动标点
    device="cuda",                   # 无GPU可改"cpu"，仍17倍实时
)

result = model.generate(
    input="repair_audio.wav",
    language="auto",    # 自动语种检测（含粤语/方言）
    use_itn=True,        # 逆文本正则化（口语→书面）
)
# 输出: "3楼B区空调不制冷，已经两天了。"
# 同时可输出情感标签（用户是否着急/愤怒→影响紧急度判断）

# 或起OpenAI兼容服务，零改造替换Whisper
# funasr-server --device cuda --port 8000
```

#### 2.3.3 基础设施与工具模块

| 子模块 | 自建工作量 | 推荐开源项目 | 借用方式 | 省掉的工作 |
|--------|-----------|-------------|----------|-----------|
| 小程序统一请求层 | 3天 | **cloudbase-agent-ui** 工具层 | 参考其request封装 | 标准鉴权+刷新+错误处理 |
| 后台管理系统脚手架 | 1周 | **Ant Design Pro** | `npm create antd-pro` | 布局+权限+菜单+CRUD |
| RAG后台管理(可选整借) | 3-4周 | **RAGFlow** / **FastGPT** | Docker部署，API集成 | 模型配置+知识库+文档管理+对话日志全套 |
| 文档处理异步队列 | 3天 | **AgentScope** + RabbitMQ | AgentScope Worker消费队列 | 任务调度+状态回调 |
| 对象存储 | 1天 | **MinIO** | Docker一键部署 | 无 |
| 监控告警 | 2-3天 | **OpenTelemetry** + Grafana | AgentScope内置OTel支持 | 自建日志+链路追踪 |

#### 2.3.4 开源项目选型对比（RAG后台）

如果不想自建Web后台的"知识库管理"部分，可以直接借用整个RAG平台：

| 项目 | Stars | 文档解析 | 混合检索 | 后台管理 | 部署复杂度 | 适合度 |
|------|-------|---------|---------|---------|-----------|--------|
| **RAGFlow** | 74K+ | 最强(深度文档理解) | 向量+BM25 | 企业级(权限/审计) | 中 | 物业文档格式复杂时首选 |
| **FastGPT** | 27K+ | 好(开箱即用) | 向量+关键词+重排 | 友好(运营可维护) | 低 | 快速上线首选 |
| **Dify** | 131K+ | 一般 | 工作流编排 | 平台级 | 中 | 偏AI应用编排，非纯知识库 |
| **MaxKB** | 20K+ | 一般 | 简单 | 极简(一键Ollama) | 极低 | 轻量场景 |

**建议：** 考虑到物业知识库包含大量PDF(入驻指南/物业条例/设备手册)，文档格式较复杂，优先评估 **RAGFlow**。如果追求最快上线，用 **FastGPT** + Unstructured做文档预处理补充。

#### 2.3.5 整合后的架构图

```
┌─────────────────────────────────────────────────────────────────┐
│  小程序端                                                         │
│  ┌────────────┐  ┌───────────────────┐  ┌──────────────────┐   │
│  │ TDesign基础 │  │ cloudbase-agent-ui │  │ 自定义报修交互页   │   │
│  │ 组件       │  │ (对话UI+流式+语音)  │  │ (拍照+按住说话)    │   │
│  └────────────┘  └───────────────────┘  └──────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS / WebSocket
┌───────────────────────────▼─────────────────────────────────────┐
│  NestJS 后端 (业务编排层)                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │ 微信登录  │ │ 工单集成  │ │ 订阅消息  │ │ Zvec (进程内嵌入)   │ │
│  │ 鉴权     │ │ 对接     │ │ 推送     │ │ 向量+全文+标量混合  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐│
│  │            HTTP 调用 Python AI 微服务                       ││
│  └──────────────────────────┬─────────────────────────────────┘│
└─────────────────────────────┼──────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────┐
│  Python AI 微服务 (AgentScope + Unstructured + FunASR)         │
│  ┌────────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │ AgentScope RAG  │ │ Unstructured │ │ FunASR (ASR+VAD+Punc)│  │
│  │ Reader/Knowledge│ │ 文档解析      │ │ 语音转文字           │  │
│  │ /Store 三层架构  │ │ PDF/Word/Excel│ │ funasr-server       │  │
│  └────────────────┘ └──────────────┘ └────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  LLM API调用 (通义千问 qwen-max / qwen-vl-max)            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
│
│  ┌──────────┐ ┌──────┐ ┌──────┐ ┌──────────┐
│  │ MySQL    │ │Redis │ │MinIO │ │ RabbitMQ │
│  └──────────┘ └──────┘ └──────┘ └──────────┘
```

#### 2.3.6 借用开源项目后的工期影响

| 阶段 | 原工期 | 借用后 | 省掉的关键工作 |
|------|--------|--------|----------------|
| M1: 基础架构 | 2周 | 1.5周 | cloudbase-agent-ui省掉请求层封装 |
| M2: AI问答MVP | 2周 | 1周 | Unstructured省文档解析 + AgentScope省RAG自研 + Zvec省向量库部署 |
| M3: 报修MVP | 1周 | 0.5周 | FunASR省ASR调优 + cloudbase-agent-ui省录音UI |
| M4: 联调优化 | 1周 | 1周 | 不变 |
| M5: 审核上线 | 1周 | 1周 | 不变 |
| **总计** | **7周** | **5周** | **节省约30%工期** |

#### 2.3.7 v3.0 架构演进：FastGPT 全包知识库问答

> 上一轮讨论后确认：FastGPT 已经把知识库管理后台、文档解析、智能分段、向量化、RAG检索、重排序、多轮对话、来源引用、对话日志全部做好，且对外提供 OpenAI 兼容的对话 API。小程序直接 POST 到 FastGPT 的 `/api/v1/chat/completions` 接口即可完成流式问答。

**不需要自建的模块（FastGPT 全包）：**
- ~~文档解析(PDF/Word/Excel)~~ → FastGPT 内置
- ~~文档分段(chunking)~~ → FastGPT 内置多种策略
- ~~向量化(Embedding)~~ → FastGPT 对接通义千问 text-embedding-v2
- ~~向量检索+全文+标量过滤~~ → FastGPT 内置混合检索
- ~~RAG检索引擎~~ → FastGPT 内置
- ~~重排序(rerank)~~ → FastGPT 内置
- ~~多轮对话管理~~ → FastGPT 内置 chatId
- ~~来源引用展示~~ → FastGPT 返回引用片段
- ~~知识库管理后台~~ → FastGPT 自带 Web UI
- ~~AI模型参数配置~~ → FastGPT 后台可配
- ~~对话日志/质量评估~~ → FastGPT 自带

**NestJS 只负责"非AI"业务：** 微信登录鉴权、工单系统对接、订阅消息推送、FunASR语音转文字、LLM信息完整性校验。

#### 2.3.8 v3.0 极简架构图

```
┌─────────────────────────────────────────────────────────────┐
│  小程序端                                                     │
│  ┌────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ TDesign基础 │  │ 对话页            │  │ 报修页            │ │
│  │ 组件       │  │ → POST FastGPT API│  │ 拍照+按住说话      │ │
│  │            │  │ ← SSE流式回答     │  │ → 上传 → NestJS   │ │
│  └────────────┘  └──────────────────┘  └──────────────────┘ │
└──────────┬─────────────────┬───────────────────┬────────────┘
           │                  │                    │
           │ 对话请求          │ 报修请求            │ 文件上传
           ▼                  ▼                    ▼
┌──────────────────┐ ┌──────────────────────────────────────┐
│  FastGPT 服务     │ │  NestJS 后端 (业务编排层)              │
│  (Docker部署)     │ │                                      │
│                  │ │  ┌──────────┐  ┌──────────────────┐  │
│  ┌─────────────┐ │ │  │ 微信登录  │  │ FunASR 语音转文字  │  │
│  │ 知识库管理   │ │ │  │ 鉴权     │  │ (SenseVoiceSmall)  │  │
│  │ (Web后台)    │ │ │  └──────────┘  └──────────────────┘  │
│  │ 文档上传     │ │ │  ┌──────────┐  ┌──────────────────┐  │
│  │ 分段预览     │ │ │  │ 工单系统  │  │ LLM 信息完整性校验 │  │
│  └─────────────┘ │ │  │ 对接     │  │ (通义千问API)      │  │
│                  │ │  └──────────┘  └──────────────────┘  │
│  ┌─────────────┐ │ │  ┌──────────┐  ┌──────────────────┐  │
│  │ RAG引擎     │ │ │  │ 订阅消息  │  │ MySQL (工单/用户)  │  │
│  │ 检索+重排   │ │ │  │ 推送     │  │ Redis (会话缓存)   │  │
│  │ LLM生成     │ │ │  └──────────┘  │ MinIO (文件存储)   │  │
│  └─────────────┘ │ │                └──────────────────┘  │
│                  │ └──────────────────────────────────────┘
│  ┌─────────────┐ │
│  │ MongoDB     │ │
│  │ + pgvector  │ │
│  └─────────────┘ │
└──────────────────┘
```

#### 2.3.9 FastGPT 对话 API 对接

FastGPT 的对话接口兼容 OpenAI 格式，小程序直接调用：

```javascript
// services/chat.service.js — 小程序直接对接 FastGPT
const FASTGPT_BASE = 'https://your-fastgpt.com/api/v1';
const FASTGPT_APIKEY = 'fastgpt-xxxxxx';  // FastGPT应用发布渠道获取

// 发起对话（流式 SSE）
function chatWithFastGPT({ message, chatId }) {
  const task = wx.request({
    url: `${FASTGPT_BASE}/chat/completions`,
    method: 'POST',
    enableChunked: true,  // 开启流式接收
    header: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FASTGPT_APIKEY}`,
    },
    data: {
      appId: 'your_app_id',     // FastGPT 应用ID
      chatId: chatId || undefined, // 传chatId关联多轮历史
      stream: true,              // 流式输出
      detail: true,              // 返回引用来源
      messages: [
        { role: 'user', content: message }
      ],
    },
  });

  // 接收SSE流式数据
  task.onChunkReceived((res) => {
    const text = decodeChunk(res.data);
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const json = JSON.parse(line.slice(6));
        // 增量更新对话气泡
        if (json.choices?.[0]?.delta?.content) {
          appendToCurrentMessage(json.choices[0].delta.content);
        }
        // 来源引用（detail=true时返回）
        if (json.choices?.[0]?.quote) {
          updateSourceCitations(json.choices[0].quote);
          // quote格式: { source: "商场运营手册.pdf", q: "营业时间10:00-22:00", score: 0.89 }
        }
      }
    }
  });

  return task;
}
```

#### 2.3.10 v3.0 各模块职责对照

| 模块 | 由谁负责 | 实现方式 |
|------|---------|---------|
| 知识库管理(文档上传/分段/预览) | **FastGPT** | 运营人员在 FastGPT Web后台操作 |
| 文档解析(PDF/Word/Excel) | **FastGPT** 内置 | 后台上传即自动解析+分段+向量化 |
| 向量检索+重排序 | **FastGPT** | 内置混合检索，配置即用 |
| AI模型配置(温度/token/prompt) | **FastGPT** 后台 | 在 FastGPT 应用编排里配 |
| 小程序对话页(流式回答+来源引用) | **小程序** → **FastGPT API** | POST `/api/v1/chat/completions`，SSE流式 |
| 多轮对话/会话管理 | **FastGPT** | 传 chatId 即可关联历史 |
| 对话日志/质量评估 | **FastGPT** | 自带后台查看 |
| 微信登录/鉴权 | **NestJS** | wx.login → JWT |
| 报修语音转文字 | **NestJS** → **FunASR** | funasr-server OpenAI兼容API |
| 报修信息完整性校验 | **NestJS** → 通义千问API | LLM检查必填字段 |
| 工单提交(现有系统对接) | **NestJS** | 调现有工单系统API |
| 订阅消息推送 | **NestJS** | 微信订阅消息API |
| 文件存储(报修照片/语音) | **NestJS** → **MinIO** | 对象存储 |

#### 2.3.11 v3.0 工期

| 阶段 | v2.0 | v3.0 | 省掉的工作 |
|------|------|------|-----------|
| M1: 基础架构+FastGPT部署 | 1.5周 | **1周** | FastGPT Docker一键起，知识库后台零开发 |
| M2: AI问答MVP | 1周 | **0.5周** | 小程序对接FastGPT API即可，不再自建RAG |
| M3: 报修MVP | 0.5周 | **0.5周** | 不变 |
| M4: 联调优化 | 1周 | **0.5周** | 组件更少，联调更简单 |
| M5: 审核上线 | 1周 | **1周** | 不变 |
| **总计** | **5周** | **3.5周** | **比原始7周省50%** |

#### 2.3.12 v3.0 vs 之前版本对比

| 维度 | v1.0(原始自建) | v2.0(AgentScope+Zvec) | v3.0(FastGPT全包) |
|------|---------------|----------------------|-------------------|
| AI问答 | 全自建RAG | AgentScope+Zvec嵌入式 | **小程序直调FastGPT API** |
| 知识库后台 | 自建React | 嵌入RAGFlow/FastGPT | **FastGPT自带Web后台** |
| 向量数据库 | Milvus独立 | Zvec进程内嵌 | FastGPT自带pgvector |
| 文档解析 | pdf-parse等 | Unstructured库 | FastGPT内置 |
| Python微服务 | 无 | AgentScope+Unstructured+FunASR | **只剩FunASR** |
| 部署组件数 | 8个 | 8个 | **5个** |
| 需维护代码量 | 最多 | 大量 | **极少** |
| 适合快速上线 | 低 | 中 | **极高** |
| 灵活性 | 最高 | 高 | 中（依赖FastGPT边界） |

---

## 三、小程序端架构设计

### 3.1 分包策略

```
金鹰世界物业小程序/
├── app.js                          # 全局逻辑
├── app.json                        # 全局配置
├── app.wxss                         # 全局样式
├── project.config.json
├── sitemap.json
│
├── pages/                          # 主包 - 核心页面
│   ├── index/                      # 首页（功能入口）
│   ├── chat/                        # AI问答对话页
│   ├── repair/                     # 智能报修入口
│   └── repair-preview/             # 工单预览确认页
│
├── subpackages/                    # 分包
│   ├── user-center/                # 个人中心分包
│   │   ├── profile/                # 个人资料
│   │   ├── history/                # 问答历史
│   │   └── settings/               # 设置
│   └── repair-detail/              # 报修详情分包
│       ├── list/                   # 我的报修列表
│       └── detail/                 # 报修详情
│
├── components/                     # 公共组件
│   ├── chat-bubble/                # 对话气泡
│   ├── source-citation/           # 来源引用
│   ├── voice-recorder/            # 语音录制器
│   ├── photo-uploader/             # 拍照上传
│   └── form-auto-fill/            # 自动填表预览
│
├── utils/                          # 工具层
│   ├── request.js                  # 统一请求封装
│   ├── auth.js                     # 微信登录&鉴权
│   ├── ws.js                       # WebSocket管理
│   ├── audio.js                    # 录音管理
│   ├── upload.js                   # 文件上传
│   └── analytics.js                # 埋点统计
│
├── services/                       # 业务API层
│   ├── chat.service.js             # 问答服务
│   ├── repair.service.js            # 报修服务
│   └── user.service.js             # 用户服务
│
└── config/                         # 配置
    └── env.js                      # 环境变量
```

### 3.2 app.json 核心配置

```json
{
  "pages": [
    "pages/index/index",
    "pages/chat/chat",
    "pages/repair/repair",
    "pages/repair-preview/repair-preview"
  ],
  "subpackages": [
    {
      "root": "subpackages/user-center",
      "name": "user-center",
      "pages": [
        "pages/profile/profile",
        "pages/history/history",
        "pages/settings/settings"
      ]
    },
    {
      "root": "subpackages/repair-detail",
      "name": "repair-detail",
      "pages": [
        "pages/list/list",
        "pages/detail/detail"
      ]
    }
  ],
  "preloadRule": {
    "pages/index/index": {
      "network": "all",
      "packages": ["user-center"]
    },
    "pages/repair/repair": {
      "network": "wifi",
      "packages": ["repair-detail"]
    }
  },
  "window": {
    "navigationBarTitleText": "金鹰世界",
    "navigationBarBackgroundColor": "#1a1a2e",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#f5f5f5"
  },
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#1a1a2e",
    "list": [
      { "pagePath": "pages/index/index", "text": "首页" },
      { "pagePath": "pages/chat/chat", "text": "智能问答" },
      { "pagePath": "pages/repair/repair", "text": "报修" }
    ]
  },
  "permission": {
    "scope.record": { "desc": "用于语音描述报修问题" },
    "scope.camera": { "desc": "用于拍摄报修现场照片" },
    "scope.userLocation": { "desc": "用于定位报修位置" }
  },
  "requiredPrivateInfos": ["chooseLocation", "getLocation"]
}
```

### 3.3 统一请求封装

```javascript
// utils/request.js
const { API_BASE_URL, WS_BASE_URL } = require('../config/env').config;

const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('access_token');
    wx.request({
      url: `${API_BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      timeout: options.timeout || 15000,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header,
      },
      success: (res) => {
        if (res.statusCode === 401) {
          return refreshTokenAndRetry(options).then(resolve).catch(reject);
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject({ code: res.statusCode, message: res.data?.message || '请求失败' });
        }
      },
      fail: (err) => {
        reject({ code: -1, message: '网络异常', detail: err });
      },
    });
  });
};

// 微信登录流程
const login = async () => {
  try {
    const { code } = await wx.login();
    const { data } = await request({
      url: '/api/auth/wechat-login',
      method: 'POST',
      data: { code },
    });
    wx.setStorageSync('access_token', data.accessToken);
    wx.setStorageSync('refresh_token', data.refreshToken);
    wx.setStorageSync('user_info', data.user);
    return data.user;
  } catch (err) {
    console.error('登录失败:', err);
    throw err;
  }
};

// Token刷新重试
async function refreshTokenAndRetry(originalOptions) {
  const refreshToken = wx.getStorageSync('refresh_token');
  if (!refreshToken) {
    await login();
    return request(originalOptions);
  }
  try {
    const { data } = await new Promise((resolve, reject) => {
      wx.request({
        url: `${API_BASE_URL}/api/auth/refresh`,
        method: 'POST',
        data: { refreshToken },
        success: resolve,
        fail: reject,
      });
    });
    wx.setStorageSync('access_token', data.accessToken);
    return request(originalOptions);
  } catch {
    await login();
    return request(originalOptions);
  }
}

module.exports = { request, login };
```

---

## 四、功能一：AI知识库问答系统

### 4.1 系统架构（参考FastGPT模式）

```
┌─────────────────────────────────────────────────────────────┐
│                      Web后台管理系统                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ 模型配置  │ │ 知识库管理│ │ 文档管理  │ │ 对话日志  │       │
│  │ ·模型选择 │ │ ·数据集   │ │ ·上传     │ │ ·会话记录 │       │
│  │ ·温度     │ │ ·向量集合 │ │ ·分段预览 │ │ ·质量评估 │       │
│  │ ·Token限制│ │ ·索引管理 │ │ ·处理状态 │ │ ·反馈分析 │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    后端知识库处理流水线                       │
│                                                             │
│  文档上传 → 格式解析 → 文本提取 → 智能分段 → 向量化 → 存储    │
│             ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ ┌────┐ │
│             │PDF   │  │Word  │  │Excel │  │Embed │ │向量│ │
│             │解析  │  │解析  │  │解析  │  │模型  │ │DB  │ │
│             └──────┘  └──────┘  └──────┘  └──────┘ └────┘ │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                      RAG问答引擎                             │
│                                                             │
│  用户提问 → Query向量化 → 向量检索 → 召回Top-K → 重排序      │
│                                        ↓                    │
│  回答生成 ← 上下文组装 ← Prompt构建 ← 结果过滤 ←              │
│      │                                                      │
│      ▼                                                      │
│  来源引用标注（文档名/页码/片段）                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 文档处理流水线

#### 4.2.1 多格式文档解析

| 格式 | 解析方案 | 关键依赖 |
|------|----------|----------|
| PDF | pdf-parse + pdfjs-dist | 文本提取+布局识别 |
| Word (.docx) | mammoth.js | 保留段落结构 |
| Excel (.xlsx) | xlsx (SheetJS) | 按行/列转换为文本表格 |
| TXT/MD | 直接读取 | 无依赖 |

#### 4.2.2 智能分段策略

```javascript
// 后端 document-processor.service.ts 核心分段逻辑

class DocumentProcessor {
  // 分段策略配置
  static CHUNK_STRATEGIES = {
    // 策略1：固定长度分段（默认）
    fixed: { chunkSize: 500, overlap: 50 },
    // 策略2：按段落分段（适合文档）
    paragraph: { maxChunkSize: 800, minChunkSize: 100 },
    // 策略3：递归分段（适合长文档）
    recursive: { chunkSize: 500, overlap: 50, separators: ['\n\n', '\n', '。', '；'] },
    // 策略4：Q&A对分段（适合FAQ）
    qa: { pattern: /^Q[:：](.*)A[:：](.*)/gm },
  };

  async processDocument(fileInfo, datasetId, strategy = 'recursive') {
    // Step 1: 格式解析
    const rawText = await this.parseByFormat(fileInfo);

    // Step 2: 文本清洗
    const cleanedText = this.cleanText(rawText);

    // Step 3: 智能分段
    const chunks = this.chunkText(cleanedText, strategy);

    // Step 4: 向量化（批量）
    const embeddings = await this.batchEmbed(chunks);

    // Step 5: 存入向量数据库
    await this.storeVectors(datasetId, chunks, embeddings, fileInfo);

    // Step 6: 更新处理状态
    await this.updateDocStatus(fileInfo.id, 'completed', { chunkCount: chunks.length });
  }

  // Excel特殊处理：按表格结构转换
  async parseExcel(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const results = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const headers = rows[0];
      // 将每行数据转换为语义文本
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const textParts = headers.map((h, idx) => `${h}: ${row[idx] || ''}`);
        results.push({
          text: `[${sheetName}] ${textParts.join('，')}`,
          meta: { sheet: sheetName, row: i + 1, source: 'excel' },
        });
      }
    }
    return results;
  }
}
```

#### 4.2.3 向量化处理

```javascript
// 向量化服务 - 使用LLM的Embedding API
class EmbeddingService {
  constructor(config) {
    this.model = config.model || 'text-embedding-v2';  // 通义千问Embedding
    this.batchSize = config.batchSize || 20;
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint;
  }

  async batchEmbed(texts) {
    const results = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const embeddings = await this.callEmbedAPI(batch);
      results.push(...embeddings);
    }
    return results;
  }

  async callEmbedAPI(texts) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    const data = await response.json();
    return data.data.map(item => item.embedding);
  }
}
```

### 4.3 RAG问答引擎

```javascript
// 后端 rag.service.ts - RAG检索增强生成

class RAGService {
  constructor(config) {
    this.llmConfig = config.llm;        // 模型参数（来自后台配置）
    this.vectorDB = config.vectorDB;    // 向量数据库客户端
    this.embeddingService = config.embedding;
    this.topK = config.topK || 5;       // 召回数量
    this.scoreThreshold = 0.7;         // 相关性阈值
  }

  // 核心问答流程
  async answer(query, conversationHistory = []) {
    // Step 1: Query预处理 & 向量化
    const processedQuery = this.preprocessQuery(query);
    const queryEmbedding = await this.embeddingService.embed(processedQuery);

    // Step 2: 向量检索召回
    const candidates = await this.vectorDB.search({
      vector: queryEmbedding,
      topK: this.topK * 2,  // 过召回，用于重排序
      filter: { dataset: 'default' },
    });

    // Step 3: 相关性过滤
    const filtered = candidates.filter(c => c.score >= this.scoreThreshold);

    // Step 4: 重排序（可选：使用Cross-Encoder）
    const reranked = await this.rerank(processedQuery, filtered);

    // Step 5: 取Top-K构建上下文
    const topResults = reranked.slice(0, this.topK);

    // Step 6: 构建Prompt
    const prompt = this.buildPrompt(query, topResults, conversationHistory);

    // Step 7: LLM生成回答（流式）
    const { answer, usage } = await this.llmChat(prompt, this.llmConfig);

    // Step 8: 标注来源引用
    const citations = topResults.map((r, idx) => ({
      index: idx + 1,
      docName: r.payload.docName,
      page: r.payload.page,
      snippet: r.payload.text.substring(0, 100),
      score: r.score,
    }));

    return {
      answer,
      citations,
      usage,
      retrievedCount: candidates.length,
      usedCount: topResults.length,
    };
  }

  buildPrompt(query, results, history) {
    const context = results
      .map((r, i) => `[片段${i + 1}] 来源：${r.payload.docName}\n${r.payload.text}`)
      .join('\n\n---\n\n');

    const historyText = history
      .slice(-6)  // 最近3轮对话
      .map(h => `用户: ${h.question}\n助手: ${h.answer}`)
      .join('\n\n');

    return `你是金鹰世界商场的智能客服助手。请根据以下知识库片段回答用户问题。

【知识库片段】
${context}

【对话历史】
${historyText || '（无历史对话）'}

【用户问题】
${query}

【回答要求】
1. 仅基于上方知识库片段回答，不要编造信息
2. 如果知识库中没有相关信息，请明确告知用户并建议联系物业前台
3. 回答中引用的片段用 [片段N] 标注来源
4. 回答简洁专业，语气友好`;
  }

  // 流式LLM调用
  async llmChat(prompt, config) {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,           // 如 qwen-max
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature || 0.3,
        max_tokens: config.maxTokens || 2000,
        stream: true,
      }),
    });
    // 流式解析...
    return this.parseStreamResponse(response);
  }
}
```

### 4.4 Web后台管理系统

```
后台管理系统 (React + Ant Design Pro)
│
├── /login                    # 管理员登录
├── /dashboard                # 概览面板
│   ├── 对话量统计
│   ├── 知识库状态
│   └── 系统健康度
│
├── /ai-config                 # AI模型配置
│   ├── 模型选择 (qwen-max / qwen-plus / qwen-turbo)
│   ├── Temperature调节 (0-1.0)
│   ├── Max Tokens限制 (100-4000)
│   ├── Top K召回数量
│   ├── Score阈值
│   └── Prompt模板编辑
│
├── /knowledge-base            # 知识库管理
│   ├── 数据集列表
│   ├── 创建/编辑数据集
│   ├── 向量索引状态
│   └── 索引重建
│
├── /documents                 # 文档管理
│   ├── 上传文档 (拖拽/批量)
│   ├── 格式：PDF / Word / Excel / TXT / MD
│   ├── 分段策略选择
│   ├── 分段预览（实时预览效果）
│   ├── 处理状态追踪
│   └── 文档删除/重新处理
│
├── /conversations             # 对话管理
│   ├── 会话列表
│   ├── 对话详情查看
│   ├── 用户反馈分析
│   └── 质量标注（优化训练数据）
│
└── /system                    # 系统设置
    ├── 用户权限管理
    ├── API密钥管理
    └── 操作日志
```

### 4.5 小程序端问答交互

```javascript
// pages/chat/chat.js - AI问答页面
const { request } = require('../../utils/request');
const chatService = require('../../services/chat.service');

Page({
  data: {
    messages: [],          // 对话消息列表
    inputValue: '',
    isStreaming: false,     // 流式回答中
    sessionId: '',
    showSources: null,      // 当前展开的来源引用
  },

  onLoad() {
    this.initSession();
  },

  // 初始化会话
  async initSession() {
    try {
      const { sessionId } = await chatService.createSession();
      this.setData({ sessionId });
    } catch (err) {
      wx.showToast({ title: '初始化失败', icon: 'none' });
    }
  },

  // 发送消息 - WebSocket流式
  async sendMessage() {
    const { inputValue, sessionId, messages } = this.data;
    if (!inputValue.trim() || this.data.isStreaming) return;

    // 添加用户消息
    const userMsg = { role: 'user', content: inputValue, time: Date.now() };
    const assistantMsg = { role: 'assistant', content: '', sources: [], streaming: true };

    this.setData({
      messages: [...messages, userMsg, assistantMsg],
      inputValue: '',
      isStreaming: true,
    });

    // WebSocket流式接收回答
    chatService.streamChat({
      sessionId,
      message: inputValue,
      onMessage: (chunk) => {
        // 增量更新助手回答
        const lastMsg = this.data.messages[this.data.messages.length - 1];
        lastMsg.content += chunk.text;
        this.setData({
          [`messages[${this.data.messages.length - 1}].content`]: lastMsg.content,
        });
      },
      onSources: (sources) => {
        this.setData({
          [`messages[${this.data.messages.length - 1}].sources`]: sources,
        });
      },
      onComplete: () => {
        this.setData({
          [`messages[${this.data.messages.length - 1}].streaming`]: false,
          isStreaming: false,
        });
        // 滚动到底部
        this.scrollToBottom();
      },
      onError: (err) => {
        wx.showToast({ title: '回答失败，请重试', icon: 'none' });
        this.setData({ isStreaming: false });
      },
    });
  },

  // 查看来源引用
  toggleSources(e) {
    const idx = e.currentTarget.dataset.idx;
    this.setData({
      showSources: this.data.showSources === idx ? null : idx,
    });
  },

  scrollToBottom() {
    wx.nextTick(() => {
      wx.createSelectorQuery()
        .select('#chat-list')
        .boundingClientRect((rect) => {
          wx.pageScrollTo({ scrollTop: rect.height, duration: 200 });
        })
        .exec();
    });
  },

  onShareAppMessage() {
    return {
      title: '金鹰世界智能客服 - 随时为您解答',
      path: '/pages/chat/chat',
    };
  },
});
```

```javascript
// services/chat.service.js - WebSocket流式问答服务
const { WS_BASE_URL } = require('../config/env').config;
const { request } = require('../utils/request');

class ChatService {
  constructor() {
    this.ws = null;
    this.messageHandlers = {};
  }

  async createSession() {
    return request({ url: '/api/chat/sessions', method: 'POST' });
  }

  // WebSocket流式问答
  streamChat({ sessionId, message, onMessage, onSources, onComplete, onError }) {
    const token = wx.getStorageSync('access_token');
    this.ws = wx.connectSocket({
      url: `${WS_BASE_URL}/ws/chat?token=${token}`,
      success: () => {},
    });

    this.ws.onOpen(() => {
      this.ws.send({
        data: JSON.stringify({
          type: 'chat',
          sessionId,
          message,
        }),
      });
    });

    this.ws.onMessage((res) => {
      const data = JSON.parse(res.data);
      switch (data.type) {
        case 'chunk':
          onMessage(data);
          break;
        case 'sources':
          onSources(data.sources);
          break;
        case 'complete':
          onComplete(data);
          this.ws.close();
          break;
        case 'error':
          onError(data);
          this.ws.close();
          break;
      }
    });

    this.ws.onError((err) => onError(err));
  }

  // 获取历史会话
  async getHistory(page = 1, pageSize = 20) {
    return request({
      url: `/api/chat/sessions/history?page=${page}&pageSize=${pageSize}`,
    });
  }

  // 获取会话详情
  async getSessionDetail(sessionId) {
    return request({ url: `/api/chat/sessions/${sessionId}` });
  }
}

module.exports = new ChatService();
```

### 4.6 来源引用展示组件

```xml
<!-- components/source-citation/source-citation.wxml -->
<view class="sources-container" wx:if="{{sources && sources.length}}">
  <view class="sources-header" bindtap="toggleExpand">
    <text class="sources-title">回答来源 ({{sources.length}})</text>
    <text class="sources-arrow {{expanded ? 'expanded' : ''}}">›</text>
  </view>
  <view class="sources-list" wx:if="{{expanded}}">
    <view class="source-item" wx:for="{{sources}}" wx:key="index" bindtap="onSourceTap" data-index="{{index}}">
      <view class="source-badge">{{item.index}}</view>
      <view class="source-content">
        <text class="source-name">{{item.docName}}</text>
        <text class="source-snippet">{{item.snippet}}...</text>
        <text class="source-score">相关度 {{item.scorePercent}}%</text>
      </view>
    </view>
  </view>
</view>
```

---

## 五、功能二：智能报修功能

### 5.1 设计理念

> **照片是工单附件，不是AI分析对象。** AI只负责"语音转文字 + 信息完整性校验"。
> - 语音转文字后，LLM检查描述中是否包含工单必填信息（报修类型、位置、问题描述）
> - 信息齐全 → 直接填入工单表单，用户确认提交
> - 信息缺失 → AI明确告知缺什么，引导用户补充

不做图片理解(VLM)，不做过度推理，照片原样填入工单附件。

### 5.2 交互流程设计

```
用户进入报修
    │
    ▼
┌──────────────────────────┐
│  采集界面                  │
│                          │
│  [拍照]   ← 1-3张照片     │
│  [按住说话] ← 语音描述问题 │
│                          │
└──────────┬───────────────┘
           │ 拍照 + 语音
           ▼
┌──────────────────────────┐
│  AI处理                   │
│                          │
│  1. 上传照片 → 对象存储    │  ← 照片只存储，不分析
│  2. 上传语音 → 对象存储    │
│  3. FunASR 语音转文字     │  ← ASR识别
│  4. LLM 信息完整性校验     │  ← 检查缺不缺字段
│                          │
│  ┌─────────────────────┐ │
│  │ 校验结果判定：       │ │
│  │                     │ │
│  │ A. 信息齐全 → 填表  │ │
│  │ B. 缺信息 → 追问    │ │
│  └─────────────────────┘ │
└──────────┬───────────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
┌─────────┐  ┌──────────────────┐
│ A.预览页 │  │ B.补充信息页       │
│         │  │                  │
│ 类型:空调 │  │ "请补充：报修位置"│
│ 位置:3楼B│  │ [文字/语音补充]    │
│ 描述:不制冷│ │                  │
│ 照片:[图] │  │ → 重新校验        │
│         │  │ → 齐全后进入预览页 │
│ [确认提交]│  └──────────────────┘
└────┬────┘
     │ 确认提交
     ▼
┌──────────────────────────┐
│  提交成功                  │
│  工单号: WX20260717001    │
│  预计响应: 2小时内        │
│  [查看详情] [返回首页]    │
└──────────────────────────┘
```

### 5.3 小程序端实现

```javascript
// pages/repair/repair.js - 智能报修页面
const repairService = require('../../services/repair.service');
const audioManager = require('../../utils/audio');
const { uploadFile } = require('../../utils/upload');

Page({
  data: {
    phase: 'capture',         // capture | processing | preview | success | supplement
    photoPaths: [],           // 照片路径数组（1-3张）
    isRecording: false,
    recordingDuration: 0,
    audioPath: '',
    transcribedText: '',      // 语音转文字结果
    workOrder: {},            // 工单数据
    workOrderId: '',
    processingStep: '',
    missingFields: [],        // AI检测到缺失的字段
    supplementText: '',       // 用户补充输入
    supplementCount: 0,       // 补充轮次
  },

  // 拍照（支持多张）
  async takePhoto() {
    try {
      const { tempFiles } = await wx.chooseMedia({
        count: 3,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        camera: 'back',
        sizeType: ['compressed'],
      });
      this.setData({ photoPaths: tempFiles.map(f => f.tempFilePath) });
    } catch (err) {
      wx.showToast({ title: '拍照失败', icon: 'none' });
    }
  },

  // 语音录制（按住说话）
  startRecording() {
    this.setData({ isRecording: true, recordingDuration: 0 });
    audioManager.startRecord({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      onProgress: (duration) => {
        this.setData({ recordingDuration: Math.floor(duration / 1000) });
      },
    });
  },

  // 停止录制
  async stopRecording() {
    this.setData({ isRecording: false });
    try {
      const audioPath = await audioManager.stopRecord();
      this.setData({ audioPath });
    } catch (err) {
      wx.showToast({ title: '录音失败', icon: 'none' });
    }
  },

  // AI处理核心流程
  async processWithAI() {
    if (!this.data.photoPaths.length && !this.data.audioPath) {
      wx.showToast({ title: '请拍照并语音描述', icon: 'none' });
      return;
    }

    this.setData({ phase: 'processing' });

    try {
      // Step 1: 上传照片（只存不分析）
      this.setData({ processingStep: '正在上传照片...' });
      const photoUrls = [];
      for (const path of this.data.photoPaths) {
        const url = await uploadFile(path, 'repair/images');
        photoUrls.push(url);
      }

      // Step 2: 上传语音
      this.setData({ processingStep: '正在上传语音...' });
      const audioUrl = this.data.audioPath
        ? await uploadFile(this.data.audioPath, 'repair/audios')
        : null;

      // Step 3: 调用后端 — 语音转文字 + 信息完整性校验
      this.setData({ processingStep: '语音识别中...' });
      const result = await repairService.analyzeRepairRequest({
        photoUrls,
        audioUrl,
        supplementText: this.data.supplementText || null,
        previousTranscribedText: this.data.transcribedText || null,
      });

      // result结构：
      // {
      //   transcribedText: "3楼B区空调不制冷，已经两天了",
      //   workOrder: { type, location, description, urgency },
      //   isComplete: true,        // 信息是否完整
      //   missingFields: [],       // 缺失字段列表（如 ["location"]）
      //   missingPrompt: "",       // 追问提示语
      // }

      this.setData({
        transcribedText: result.transcribedText,
        workOrder: result.workOrder,
      });

      if (result.isComplete) {
        // 信息齐全 → 进入预览页
        this.setData({ phase: 'preview' });
      } else {
        // 信息缺失 → 进入补充页
        this.setData({
          phase: 'supplement',
          missingFields: result.missingFields,
          missingPrompt: result.missingPrompt,
          supplementText: '',
        });
      }
    } catch (err) {
      wx.showToast({ title: '处理失败，请手动填写', icon: 'none' });
      this.setData({ phase: 'manual' });
    }
  },

  // 补充信息后重新提交校验
  async submitSupplement() {
    if (!this.data.supplementText.trim()) {
      wx.showToast({ title: '请输入补充信息', icon: 'none' });
      return;
    }
    // 带着补充信息重新走AI校验
    this.setData({ supplementCount: this.data.supplementCount + 1 });
    await this.processWithAI();
  },

  // 预览页 - 编辑工单字段
  onFieldChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`workOrder.${field}`]: e.detail.value });
  },

  // 确认提交工单
  async submitWorkOrder() {
    const { workOrder } = this.data;
    if (!workOrder.type || !workOrder.description) {
      wx.showToast({ title: '请填写必要信息', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });
    try {
      const result = await repairService.submitWorkOrder({
        ...workOrder,
        photoUrls: this.data.photoUrls || [],
        audioUrl: this.data.audioPath,
        source: 'ai_assist',
      });

      this.setData({
        phase: 'success',
        workOrderId: result.workOrderId,
      });

      // 请求订阅消息（报修进度通知）
      await repairService.requestProgressNotification();
    } catch (err) {
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
});
```

### 5.4 报修WXML - 交互界面

```xml
<!-- pages/repair/repair.wxml -->
<view class="repair-container">

  <!-- 阶段1: 拍照+语音采集 -->
  <view class="capture-phase" wx:if="{{phase === 'capture'}}">
    <view class="capture-header">
      <text class="capture-title">智能报修</text>
      <text class="capture-subtitle">拍照并语音描述问题，AI帮你填表</text>
    </view>

    <!-- 照片区（1-3张） -->
    <view class="photo-area">
      <view class="photo-grid">
        <image wx:for="{{photoPaths}}" wx:key="*this" src="{{item}}" mode="aspectFill" class="photo-thumb" />
        <view class="photo-add" bindtap="takePhoto" wx:if="{{photoPaths.length < 3}}">
          <text class="add-icon">+</text>
          <text class="add-text">拍照</text>
        </view>
      </view>
    </view>

    <!-- 语音录制区 -->
    <view class="voice-area">
      <view class="voice-button {{isRecording ? 'recording' : ''}}"
            bindtouchstart="startRecording"
            bindtouchend="stopRecording">
        <view class="voice-wave" wx:if="{{isRecording}}"></view>
        <text class="voice-text">
          {{isRecording ? recordingDuration + 's 录音中...' : '按住说话'}}
        </text>
      </view>
      <text class="voice-tip" wx:if="{{audioPath}}">已录制 {{recordingDuration}}s</text>
    </view>

    <view class="ai-submit-btn {{(photoPaths.length > 0 && audioPath) ? 'active' : 'disabled'}}"
          bindtap="processWithAI">
      开始识别
    </view>
  </view>

  <!-- 阶段2: AI处理中 -->
  <view class="processing-phase" wx:if="{{phase === 'processing'}}">
    <view class="processing-animation">
      <view class="processing-ring"></view>
    </view>
    <text class="processing-text">{{processingStep}}</text>
  </view>

  <!-- 阶段3: 信息补充（AI检测到缺失字段） -->
  <view class="supplement-phase" wx:if="{{phase === 'supplement'}}">
    <view class="supplement-header">
      <text class="supplement-title">需要补充信息</text>
    </view>

    <!-- 已识别的内容 -->
    <view class="recognized-card" wx:if="{{transcribedText}}">
      <text class="card-label">已识别内容</text>
      <text class="card-content">{{transcribedText}}</text>
    </view>

    <!-- AI追问 -->
    <view class="missing-card">
      <view class="missing-icon">!</view>
      <text class="missing-prompt">{{missingPrompt}}</text>
    </view>

    <!-- 补充输入（文字或语音） -->
    <view class="supplement-input">
      <textarea class="supplement-textarea"
                placeholder="请补充缺失的信息..."
                value="{{supplementText}}"
                bindinput="onSupplementInput" />
      <view class="supplement-actions">
        <view class="supplement-voice-btn"
              bindtouchstart="startRecording"
              bindtouchend="stopRecording">
          {{isRecording ? '录音中...' : '语音补充'}}
        </view>
      </view>
    </view>

    <view class="supplement-submit-btn" bindtap="submitSupplement">重新校验</view>
  </view>

  <!-- 阶段4: 工单预览确认 -->
  <view class="preview-phase" wx:if="{{phase === 'preview'}}">
    <view class="preview-header">
      <text class="preview-title">请确认工单信息</text>
      <text class="preview-badge">AI已填写</text>
    </view>

    <!-- 语音识别结果 -->
    <view class="transcription-card">
      <text class="card-label">语音识别结果</text>
      <text class="card-content">{{transcribedText}}</text>
    </view>

    <!-- 自动填写的表单 -->
    <view class="form-card">
      <view class="form-item">
        <text class="form-label">报修类型</text>
        <input class="form-input" value="{{workOrder.type}}"
               data-field="type" bindinput="onFieldChange" />
      </view>
      <view class="form-item">
        <text class="form-label">报修位置</text>
        <input class="form-input" value="{{workOrder.location}}"
               data-field="location" bindinput="onFieldChange" />
      </view>
      <view class="form-item">
        <text class="form-label">问题描述</text>
        <textarea class="form-textarea" value="{{workOrder.description}}"
                  data-field="description" bindinput="onFieldChange" />
      </view>
      <view class="form-item">
        <text class="form-label">紧急程度</text>
        <picker mode="selector" range="{{['普通', '紧急', '非常紧急']}}"
                bindchange="onUrgencyChange">
          <view class="form-picker">{{workOrder.urgency}}</view>
        </picker>
      </view>
      <view class="form-item">
        <text class="form-label">照片附件</text>
        <view class="photo-preview-list">
          <image wx:for="{{photoPaths}}" wx:key="*this" src="{{item}}" mode="aspectFill" class="form-photo" />
        </view>
      </view>
    </view>

    <view class="submit-btn" bindtap="submitWorkOrder">确认提交</view>
  </view>

  <!-- 阶段5: 提交成功 -->
  <view class="success-phase" wx:if="{{phase === 'success'}}">
    <view class="success-icon"></view>
    <text class="success-title">报修提交成功</text>
    <text class="success-order">工单号：{{workOrderId}}</text>
    <text class="success-desc">预计2小时内响应</text>
    <view class="success-actions">
      <navigator url="/subpackages/repair-detail/pages/detail/detail?id={{workOrderId}}"
                 class="action-btn primary">查看详情</navigator>
      <navigator url="/pages/index/index" open-type="switchTab" class="action-btn">返回首页</navigator>
    </view>
  </view>

</view>
```

### 5.5 后端AI分析服务

```javascript
// 后端 repair-ai.service.ts - 报修AI分析
// 设计理念：照片只存储不分析；AI只做"语音转文字 + 信息完整性校验"

class RepairAIService {
  constructor(config) {
    this.asrConfig = config.asr;     // FunASR 配置
    this.llmConfig = config.llm;     // LLM 配置
  }

  /**
   * 核心流程：
   * 1. FunASR 语音转文字
   * 2. LLM 校验信息完整性 + 字段提取
   *    - 齐全 → 返回 workOrder + isComplete=true
   *    - 缺失 → 返回 missingFields + missingPrompt + isComplete=false
   */
  async analyzeRepairRequest({ photoUrls, audioUrl, supplementText, previousTranscribedText }) {
    // Step 1: 语音转文字 (FunASR，OpenAI兼容API)
    let transcribedText = previousTranscribedText || '';
    if (audioUrl) {
      this.setData({ processingStep: '语音识别中...' });
      const asrResult = await this.speechToText(audioUrl);
      // 如果有补充文字，拼到已有识别文本后面
      transcribedText = supplementText
        ? `${transcribedText} ${supplementText}`
        : asrResult;
    } else if (supplementText) {
      transcribedText = `${transcribedText} ${supplementText}`;
    }

    // Step 2: LLM 信息完整性校验 + 字段提取
    const result = await this.checkAndExtractFields(transcribedText);

    return {
      transcribedText,
      workOrder: result.workOrder,
      isComplete: result.isComplete,
      missingFields: result.missingFields,
      missingPrompt: result.missingPrompt,
      // 照片URL原样返回，填入工单附件
      photoUrls,
    };
  }

  // FunASR 语音转文字
  async speechToText(audioUrl) {
    // FunASR funasr-server 提供 OpenAI 兼容 API
    // funasr-server --device cuda --port 8000
    const response = await fetch(`${this.asrConfig.baseUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.asrConfig.apiKey}`,
      },
      body: (() => {
        const formData = new FormData();
        formData.append('file', audioUrl);  // 音频文件
        formData.append('model', 'SenseVoiceSmall');
        formData.append('response_format', 'json');
        return formData;
      })(),
    });
    const data = await response.json();
    return data.text;
    // FunASR 输出已含自动标点，如："3楼B区空调不制冷，已经两天了。"
  }

  // LLM 信息完整性校验 + 字段提取
  async checkAndExtractFields(transcribedText) {
    const systemPrompt = `你是金鹰世界商场的报修信息校验助手。

任务：根据用户的语音描述文本，完成两件事：
1. 提取工单字段
2. 检查信息是否完整

工单必填字段：
- type: 报修类型（空调故障/电梯故障/照明问题/水管漏水/门窗损坏/其他）
- location: 报修位置（楼层+区域，如"3楼B区"）
- description: 问题描述

完整性校验规则：
- type: 能从描述中推断出报修类型即可，如"空调不冷"→type=空调故障
- location: 必须包含楼层和区域信息，缺失则标记缺失
- description: 必须有具体问题描述，不能只有类型没有细节

紧急程度判断（可选字段，不影响完整性）：
- 非常紧急：漏水/电梯困人/电路火花/有安全隐患
- 紧急：空调不制冷/灯不亮/影响正常使用
- 普通：其他情况

返回JSON格式：
{
  "workOrder": {
    "type": "字段值或null",
    "location": "字段值或null",
    "description": "字段值或null",
    "urgency": "普通/紧急/非常紧急"
  },
  "isComplete": true/false,
  "missingFields": ["缺失字段名"],
  "missingPrompt": "给用户的追问提示语（中文，口语化，如：请补充报修的具体位置，比如几楼哪个区域"
}

注意：
- 不要编造用户没说过的信息，缺失就标null
- description只做轻度整理（去口语词、加标点），不要改写原意
- missingPrompt要口语化，像人话，不要像系统报错`;

    const response = await fetch(this.llmConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.llmConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: this.llmConfig.model,      // qwen-max
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `用户描述：${transcribedText}` },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  }

  // 集成现有工单系统
  async submitToExternalSystem(workOrderData) {
    const response = await fetch(process.env.WORK_ORDER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.WORK_ORDER_API_KEY,
      },
      body: JSON.stringify({
        ...workOrderData,
        source: 'mini_program_ai',
        timestamp: new Date().toISOString(),
      }),
    });
    return response.json();
  }
}
```

### 5.6 设计要点说明

| 设计决策 | 理由 |
|---------|------|
| 照片不做VLM分析 | 照片是工单附件，供维修人员现场查看，不需要AI理解。省掉VLM调用成本和延迟 |
| AI只做两件事 | ①语音转文字(FunASR) ②信息完整性校验(LLM)。职责清晰，不过度推理 |
| 信息缺失→追问而非瞎填 | LLM检查type/location/description是否齐全，缺什么问什么，不编造 |
| 补充支持文字+语音 | 用户补充时可以选择打字或再录一段语音，补充后重新走ASR+校验 |
| FunASR自带标点恢复 | SenseVoiceSmall输出已含标点和逆文本正则化，口语→规范文本 |
| 降级到手动填报 | AI服务不可用时自动跳手动表单，保证报修功能可用 |

---

## 六、数据流设计

### 6.1 AI问答数据流

```
用户提问
    │
    ▼
小程序端
    │  WebSocket连接
    ▼
API网关 (鉴权/限流)
    │
    ▼
ChatService
    │
    ├──→ RAGService
    │       │
    │       ├──→ EmbeddingService (Query向量化)
    │       │
    │       ├──→ Milvus/Qdrant (向量检索)
    │       │       │
    │       │       └── 召回Top-K片段
    │       │
    │       ├──→ RerankService (重排序)
    │       │
    │       └──→ LLM API (流式生成回答)
    │               │
    │               └── chunk by chunk → WebSocket → 小程序
    │
    ├──→ Redis (会话上下文缓存)
    │
    └──→ MySQL (持久化会话记录)
```

### 6.2 智能报修数据流

```
用户拍照(1-3张) + 语音描述
    │
    ├──→ 照片上传 ──→ MinIO/COS (对象存储) ──→ 仅存储，不分析
    │                                         ↓ 照片URL填入工单附件
    ├──→ 语音上传 ──→ MinIO/COS (对象存储)
    │                    │
    └─────────────────────┤
                          ▼
                    FunASR (语音转文字)
                          │
                          │  "3楼B区空调不制冷，已经两天了。"
                          │  (自带标点恢复，口语→规范文本)
                          │
                          ▼
                    LLM 信息完整性校验
                          │
                    ┌─────┴─────┐
                    │           │
               信息齐全     信息缺失
                    │           │
                    ▼           ▼
              填入工单字段    返回缺失字段
              type: 空调故障  missingFields: ["location"]
              location: 3楼B区
              description: 不制冷  missingPrompt:
              urgency: 紧急      "请补充报修的具体位置"
                    │           │
                    │           ▼
                    │     补充页(文字/语音)
                    │           │
                    │      重新ASR+校验
                    │           │
                    │      (循环直到齐全)
                    │           │
                    ▼ ◄────────┘
              工单预览页 (用户确认+可编辑)
                    │
                    ▼
              WorkOrderService.submit()
                    │
                    ├──→ 现有工单系统API (集成提交)
                    ├──→ MySQL (本地工单记录)
                    └──→ 订阅消息推送 (进度通知)
```

---

## 七、后端API设计

### 7.1 核心API端点

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| **认证** | POST | /api/auth/wechat-login | 微信登录 |
| | POST | /api/auth/refresh | 刷新Token |
| **AI问答** | POST | /api/chat/sessions | 创建会话 |
| | GET | /api/chat/sessions/history | 历史会话 |
| | GET | /api/chat/sessions/:id | 会话详情 |
| | WS | /ws/chat | WebSocket流式问答 |
| **智能报修** | POST | /api/repair/analyze | AI分析报修请求 |
| | POST | /api/repair/submit | 提交工单 |
| | GET | /api/repair/list | 我的报修列表 |
| | GET | /api/repair/:id | 报修详情 |
| **后台管理** | POST | /admin/api/ai-config | 保存模型配置 |
| | GET | /admin/api/ai-config | 获取模型配置 |
| | POST | /admin/api/datasets | 创建数据集 |
| | POST | /admin/api/documents/upload | 上传文档 |
| | GET | /admin/api/documents | 文档列表 |
| | POST | /admin/api/documents/:id/reprocess | 重新处理文档 |
| | GET | /admin/api/conversations | 对话记录列表 |

### 7.2 数据库核心表设计

```sql
-- 用户表
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(64) UNIQUE NOT NULL,
  unionid VARCHAR(64),
  nickname VARCHAR(128),
  avatar_url VARCHAR(512),
  phone VARCHAR(20),
  role ENUM('customer', 'tenant', 'admin') DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- AI会话表
CREATE TABLE chat_sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  session_id VARCHAR(64) UNIQUE NOT NULL,
  title VARCHAR(256),
  message_count INT DEFAULT 0,
  status ENUM('active', 'archived') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_created (created_at)
);

-- 对话消息表
CREATE TABLE chat_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_id BIGINT NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  content TEXT NOT NULL,
  citations JSON,          -- 来源引用
  tokens_used INT,
  response_time_ms INT,   -- 响应耗时
  feedback TINYINT,        -- -1差评 0未评 1好评
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session (session_id),
  FULLTEXT INDEX idx_content (content)
);

-- 知识库数据集
CREATE TABLE kb_datasets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  vector_collection VARCHAR(128),  -- 向量DB集合名
  document_count INT DEFAULT 0,
  chunk_count INT DEFAULT 0,
  status ENUM('active', 'building', 'error') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 知识库文档
CREATE TABLE kb_documents (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  dataset_id BIGINT NOT NULL,
  filename VARCHAR(256) NOT NULL,
  file_type ENUM('pdf', 'docx', 'xlsx', 'txt', 'md') NOT NULL,
  file_url VARCHAR(512) NOT NULL,
  file_size BIGINT,
  chunk_strategy VARCHAR(32) DEFAULT 'recursive',
  chunk_count INT DEFAULT 0,
  status ENUM('pending', 'processing', 'completed', 'error') DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dataset (dataset_id),
  INDEX idx_status (status)
);

-- 报修工单表
CREATE TABLE repair_orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(32) UNIQUE NOT NULL,
  user_id BIGINT NOT NULL,
  type VARCHAR(64),          -- 报修类型
  category VARCHAR(64),      -- 大类
  sub_category VARCHAR(64),  -- 小类
  location VARCHAR(256),     -- 报修位置
  description TEXT,          -- 问题描述
  urgency ENUM('normal', 'urgent', 'critical') DEFAULT 'normal',
  image_urls JSON,          -- 照片URL列表
  audio_url VARCHAR(512),   -- 语音URL
  transcribed_text TEXT,     -- 语音转文字
  ai_confidence DECIMAL(3,2),-- AI置信度
  source ENUM('ai_assist', 'manual') DEFAULT 'ai_assist',
  external_order_id VARCHAR(64), -- 外部工单系统ID
  status ENUM('pending', 'accepted', 'processing', 'completed', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
);

-- AI模型配置表
CREATE TABLE ai_model_configs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(64) UNIQUE NOT NULL,
  config_value JSON NOT NULL,
  -- JSON结构: { model, temperature, maxTokens, topK, scoreThreshold, prompt, ... }
  description TEXT,
  updated_by VARCHAR(64),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 八、第三方服务集成方案

### 8.1 微信生态集成

| 能力 | 用途 | 实现要点 |
|------|------|----------|
| 微信登录 | 用户身份 | wx.login → 后端换session → JWT |
| 微信支付 | 报修收费(如有) | 后端预下单 → wx.requestPayment |
| 订阅消息 | 报修进度通知 | 报修提交后请求授权 → 后端推送 |
| 分享 | 问答/报修分享 | onShareAppMessage + onShareTimeline |
| 图片识别 | 拍照增强 | wx.chooseMedia → 压缩上传 |
| 语音能力 | 语音录制 | wx.getRecorderManager → 上传ASR |
| 地理位置 | 定位报修位置 | wx.getLocation → 地址解析 |

### 8.2 AI服务集成

| 服务 | 用途 | 推荐方案 | 备选 |
|------|------|----------|------|
| LLM对话 | 问答生成 | 通义千问 qwen-max | 文心一言 ERNIE-Bot |
| Embedding | 向量化 | 通义 text-embedding-v2 | OpenAI ada-002 |
| VLM图片 | 报修图片理解 | qwen-vl-max | GPT-4V |
| ASR语音 | 语音转文字 | 阿里云实时ASR | Whisper |
| 向量数据库 | 语义检索 | Milvus (自建) | 腾讯云向量DB |

### 8.3 基础设施集成

| 服务 | 用途 | 方案 |
|------|------|------|
| 对象存储 | 文档/图片/语音 | MinIO自建 或 腾讯云COS |
| 消息队列 | 文档处理异步 | RabbitMQ |
| 搜索引擎 | 全文检索 | Elasticsearch |
| 文件解析 | PDF/Word/Excel | pdf-parse + mammoth + xlsx |
| 缓存 | 会话/配置 | Redis |
| 监控 | 错误/性能 | Sentry + 自建Dashboard |

---

## 九、安全与合规

### 9.1 数据安全

```
✅ HTTPS全站强制 + HSTS
✅ JWT Token (15min过期) + Refresh Token (7天)
✅ 敏感字段加密存储 (手机号等)
✅ API请求签名验证 (防篡改)
✅ 文件上传类型/大小白名单
✅ 用户数据隔离 (多租户安全)
✅ 操作审计日志
✅ 数据定期备份策略
```

### 9.2 微信合规

```
✅ 隐私协议页面 (必须)
✅ 用户授权弹窗 (使用前说明)
✅ scope.record 录音权限
✅ scope.camera 拍照权限
✅ scope.userLocation 定位权限
✅ 订阅消息 (用户主动授权)
✅ 域名白名单配置 (request/socket/uploadFile/downloadFile)
✅ 内容安全检测 (msgSecCheck/imgSecCheck) - 如有UGC
✅ ICP备案 + 小程序备案
```

### 9.3 AI合规

```
✅ AI生成内容标注 "AI生成"
✅ 不存储用户对话训练模型 (除非明确授权)
✅ 知识库文档权限隔离
✅ LLM输出安全过滤 (敏感词/违规内容)
✅ 回答溯源 (来源引用可追溯)
```

---

## 十、性能优化策略

### 10.1 小程序端

| 优化项 | 策略 |
|--------|------|
| 启动速度 | 主包 < 1.5MB，核心页延迟加载 |
| 分包预加载 | preloadRule按场景预加载 |
| setData优化 | 纯数据字段、路径更新、批量合并 |
| 图片优化 | WebP格式、懒加载、CDN缩略图 |
| WebSocket | 心跳保活、断线重连、消息缓冲 |
| 录音优化 | 16kHz单声道、压缩格式amr |

### 10.2 后端性能

| 优化项 | 策略 |
|--------|------|
| 向量检索 | HNSW索引、分区检索、缓存热点Query |
| LLM调用 | 流式输出、结果缓存(相似Query)、并发控制 |
| 文档处理 | 异步队列处理、批量向量化 |
| 会话缓存 | Redis缓存上下文，减少DB查询 |
| 连接池 | MySQL/Redis/向量DB连接池管理 |

---

## 十一、部署架构

```
                    ┌──────────────┐
                    │   Nginx LB   │
                    │  (HTTPS/SSL) │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
    │ 小程序API   │ │ 后台API   │ │ WebSocket   │
    │ (NestJS)    │ │ (NestJS)  │ │ Service     │
    │ :3001       │ │ :3002     │ │ :3003       │
    └──────┬──────┘ └─────┬─────┘ └──────┬──────┘
           │               │               │
    ┌──────┴───────────────┴───────────────┘
    │
    │         ┌──────────────────────┐
    │         │   文档处理Worker      │
    │         │   (文档解析+向量化)    │
    │         └──────────┬───────────┘
    │                    │
    ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
    │MySQL │ │Redis │ │Milvus│ │MinIO │ │MQ    │
    │主从  │ │集群  │ │     │ │     │ │      │
    └──────┘ └──────┘ └──────┘ └──────┘ └──────┘
```

---

## 十二、项目里程碑

### 一期：AI知识库问答（3.5周）

| 阶段 | 周期 | 交付物 |
|------|------|--------|
| P1-1: 基础架构+FastGPT部署 | 第1周 | 小程序骨架、NestJS框架、微信登录、FastGPT Docker部署+知识库配置 |
| P1-2: 问答MVP | 第1.5周 | 小程序对话页(对接FastGPT API)、SSE流式回答、来源引用展示、多轮对话 |
| P1-3: 联调+审核 | 第1周 | 端到端联调、性能优化、隐私协议、微信审核提交 |

**一期交付：**
- 小程序首页 + AI问答对话页 + 历史记录
- FastGPT知识库后台（运营人员上传PDF/Word/Excel培训文档→自动解析→问答）
- 通义千问LLM对接（在FastGPT后台配置）
- 微信审核上线

**部署组件：** FastGPT(Docker) + NestJS + MySQL + MinIO

---

### 二期：智能报修（2周）

| 阶段 | 周期 | 交付物 |
|------|------|--------|
| P2-1: 报修采集+ASR | 第1周 | 拍照界面、按住说话录音、FunASR语音转文字、MinIO文件上传 |
| P2-2: AI校验+工单 | 第1周 | LLM信息完整性校验(缺失追问)、工单预览页、确认提交、订阅消息推送 |

**二期交付：**
- 报修采集页（拍照1-3张 + 按住说话）
- FunASR语音转文字（SenseVoiceSmall，CPU或GPU）
- LLM信息完整性校验（检查type/location/description是否齐全，缺失追问补充）
- 工单预览页（AI填写+用户可编辑+确认提交）
- 对接现有工单系统API
- 订阅消息推送报修进度

**部署组件新增：** FunASR (Docker)

**二期注意：** 报修需要 scope.record + scope.camera 权限声明，更新隐私协议后重新提交审核。

---

### 三期：培训+考试（4周）

| 阶段 | 周期 | 交付物 |
|------|------|--------|
| P3-1: 培训内容浏览 | 第1周 | 培训课程列表页、课程详情页(视频/文档播放)、学习进度记录 |
| P3-2: AI培训助手 | 第0.5周 | FastGPT新建培训知识库应用，小程序复用对话页传不同appId |
| P3-3: 考试系统 | 第1.5周 | 题库管理(后台)、考试页(单选/多选/判断)、计时、自动评分 |
| P3-4: 证书+统计 | 第1周 | 电子证书生成、学习数据看板、培训覆盖率统计 |

**三期交付：**
- 培训课程列表 + 课程详情（视频播放/文档阅读）
- AI培训助手（**零开发复用FastGPT**，新建培训知识库+应用，小程序传不同appId即可）
- 题库管理后台（NestJS CRUD）
- 小程序考试页（选择题渲染、计时、提交、评分）
- 电子证书生成（Canvas绘制证书图片保存）
- 培训数据统计（完成率/平均分/覆盖率）

**新增表：**
```sql
-- 培训课程
CREATE TABLE training_courses (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(256) NOT NULL,
  description TEXT,
  content_type ENUM('video', 'document', 'article') NOT NULL,
  content_url VARCHAR(512),     -- MinIO URL
  cover_url VARCHAR(512),
  sort_order INT DEFAULT 0,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 学习记录
CREATE TABLE training_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  course_id BIGINT NOT NULL,
  status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
  progress INT DEFAULT 0,       -- 0-100
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  UNIQUE KEY uk_user_course (user_id, course_id)
);

-- 考试题库
CREATE TABLE exam_questions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  course_id BIGINT NOT NULL,
  type ENUM('single_choice', 'multi_choice', 'true_false', 'fill_blank') NOT NULL,
  content TEXT NOT NULL,        -- 题干
  options JSON,                 -- 选项 ["A.xxx","B.xxx",...]
  answer JSON,                  -- 正确答案 ["A"] 或 ["A","C"] 或 "对"
  score INT DEFAULT 5,          -- 分值
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_course (course_id)
);

-- 考试记录
CREATE TABLE exam_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  course_id BIGINT NOT NULL,
  answers JSON,                 -- 用户作答 {"q1":"A","q2":["B","C"]}
  score INT,                   -- 得分
  total_score INT,              -- 满分
  passed BOOLEAN,              -- 是否及格
  duration_seconds INT,        -- 答题用时
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_course (user_id, course_id)
);

-- 证书
CREATE TABLE training_certificates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  course_id BIGINT NOT NULL,
  certificate_no VARCHAR(64) UNIQUE NOT NULL,
  issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiry_date TIMESTAMP NULL,  -- 过期时间（定期复训）
  INDEX idx_user (user_id)
);
```

**新增API端点：**
```
培训模块：
  GET    /api/training/courses              课程列表
  GET    /api/training/courses/:id          课程详情
  POST   /api/training/records              更新学习进度
  GET    /api/training/records/progress     我的培训进度

考试模块：
  GET    /api/exam/questions/:courseId       获取考试题目
  POST   /api/exam/submit                   提交考试
  GET    /api/exam/result/:id               考试结果

证书模块：
  GET    /api/certificate/list              我的证书
  GET    /api/certificate/:id/image         证书图片
```

**三期不新增部署组件** — FastGPT已在一期部署，培训问答只是新建一个知识库应用；考试和证书都是NestJS+MySQL标准CRUD。

---

### 三期总览

| 期次 | 功能 | 工期 | 累计 | 新增组件 | 服务器内存 |
|------|------|------|------|---------|-----------|
| **一期** | AI知识库问答 | 3.5周 | 3.5周 | FastGPT + NestJS + MySQL + MinIO | 8-12GB |
| **二期** | 智能报修 | 2周 | 5.5周 | + FunASR | 12-16GB |
| **三期** | 培训+考试 | 4周 | 9.5周 | 无新增 | 不变 |

**渐进式上线节奏：**
```
一期上线（3.5周）
  → 用户能用AI问答解决物业问题
  → 运营人员上传知识库文档，持续优化回答质量

二期上线（+2周）
  → 用户拍照+语音报修，AI填表
  → 对接现有工单系统，闭环维修流程

三期上线（+4周）
  → 员工/租户在线学习培训内容
  → AI培训助手随时解答
  → 考试+证书闭环培训管理
```

---

## 十三、风险与应对

| 风险 | 概率 | 影响 | 应对策略 |
|------|------|------|----------|
| LLM回答不准确 | 中 | 高 | 优化知识库分段、调整Prompt、添加兜底回答 |
| ASR识别偏差 | 中 | 中 | 支持手动编辑转文字、多方言模型 |
| 微信审核被拒 | 低 | 高 | 严格隐私合规、AI内容标注、提前预审 |
| 主包超2MB | 中 | 中 | 图片CDN化、按需加载、TDesign按需引入 |
| 向量检索延迟 | 低 | 中 | HNSW索引、缓存热点、分区优化 |
| 外部工单系统接口不稳 | 中 | 高 | 超时降级手动填写、重试机制、本地留存 |
