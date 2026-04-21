# AI Assistant

这是一个 AI 智能助手全栈项目，包含后端 API 服务和简单的前端界面。

---

## 项目结构

```
my_ai_assistant/
├── docker-compose.yml      # Docker 编排配置
├── frontend/
│   └── index.html        # 简单聊天前端页面
└── backend/
    ├── Dockerfile
    ├── requirements.txt
    ├── .env.example
    └── app/
        ├── main.py           # FastAPI 应用入口
        ├── config.py         # 配置管理
        ├── database.py      # SQLAlchemy 异步数据库
        ├── models.py       # 数据模型
        ├── auth.py        # JWT 认证逻辑
        ├── llm.py         # LLM 调用封装（OpenAI/通义千问）
        ├── rag.py         # RAG 向量检索
        ├── tools.py       # AI 工具（天气查询）
        ├── redis_client.py
        └── api/
            ├── __init__.py
            ├── auth.py      # 注册/登录接口
            ├── user.py    # 当前用户信息
            ├── chat.py    # 聊天/SSE流式响应
            └── knowledge.py # 知识库管理（PDF上传）
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **Web框架** | FastAPI + Uvicorn |
| **数据库** | PostgreSQL (asyncpg) + Redis |
| **ORM** | SQLAlchemy 2.0 (异步) |
| **认证** | JWT (python-jose) + bcrypt |
| **AI/LLM** | OpenAI GPT-3.5 / 阿里通义千问 |
| **向量库** | ChromaDB + LangChain |
| **PDF解析** | PyPDF2 |
| **前端** | 原生 HTML + SSE 流式读取 |

---

## 核心功能

### 1. 认证系统

- 用户注册/登录 (`/api/auth/register`, `/api/auth/login`)
- JWT Token 认证，30分钟过期
- OAuth2PasswordBearer 保护接口

### 2. 聊天功能

- 创建会话、列出历史会话 (`/api/chat/conversations`)
- 流式 SSE 响应 (`/api/chat/chat`) - 支持实时逐字返回
- 消息历史存储（最近20条）
- 可选知识库 RAG 增强

### 3. 知识库 (RAG)

- 创建知识库 (`/api/knowledge/create`)
- 上传 PDF/文本文件 (`/api/knowledge/{kb_id}/upload`)
- 向量化存储，语义检索返回 top 3

### 4. AI 工具

- 天气查询工具 (OpenWeatherMap API)

### 5. 配置

- 支持 OpenAI / 通义千问 切换
- 配置通过 `.env` 文件加载

---

## API 接口汇总

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/auth/register` | 注册用户 |
| POST | `/api/auth/login` | 登录获取Token |
| GET | `/api/user/me` | 获取当前用户信息 |
| POST | `/api/chat/conversations` | 创建会话 |
| GET | `/api/chat/conversations` | 列出所有会话 |
| POST | `/api/chat/chat` | 流式聊天(SSE) |
| POST | `/api/knowledge/create` | 创建知识库 |
| GET | `/api/knowledge/list` | 列出知识库 |
| POST | `/api/knowledge/{id}/upload` | 上传文档 |

---

## 启动方式

```bash
docker-compose up --build
```

服务端口：

- **Backend**: `http://localhost:8000`
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

---

## 配置说明

在 `backend/.env` 中配置以下环境变量：

```env
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql+asyncpg://postgres:password@db:5432/aiassistant
REDIS_URL=redis://redis:6379/0
OPENAI_API_KEY=your-openai-api-key
# 可选：使用通义千问
LLM_PROVIDER=dashscope
DASHSCOPE_API_KEY=your-dashscope-api-key
# 可选：天气API
WEATHER_API_KEY=your-weather-api-key
```
