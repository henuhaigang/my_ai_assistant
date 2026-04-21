# AI Assistant Application

An AI assistant application with chat, knowledge base, and RAG capabilities built with FastAPI.

## Features

- **Chat Functionality**: 
  - Conversation management (create/list/get messages)
  - Streaming chat responses using Server-Sent Events
  - Context preservation in conversations
  - System prompt support

- **File Analysis & Upload**:
  - Support for multiple file formats (PDF, Word documents, Excel spreadsheets, plain text)
  - Automatic content extraction and analysis
  - Direct upload with optional knowledge base storage
  - File metadata collection (size, type, page count, etc.)
  
- **Knowledge Base Management**:
  - Document embedding and storage
  - Vector-based document search
  - Context-aware responses

- **Authentication**:
  - JWT-based user registration and login
  - Password hashing with bcrypt

- **LLM Integration**:
  - Support for multiple LLM providers (OpenAI, DashScope, Ollama)
  - Streaming response generation

- **Tool Calling**:
  - Weather lookup tool integration
  - Extensible tool system

## Architecture

### Backend
- Built with FastAPI using async/await patterns
- Database models for users, conversations, messages, and knowledge bases
- Authentication system with JWT tokens and password hashing
- Support for multiple LLM providers (OpenAI, DashScope, Ollama)
- RAG functionality using ChromaDB and LangChain
- Knowledge base management with PDF document upload capabilities
- Streaming chat responses via Server-Sent Events

### Directory Structure
```
backend/
├── app/
│   ├── api/          # API endpoints
│   ├── models/       # Database models
│   ├── database.py   # Database connection setup
│   ├── auth.py       # Authentication logic
│   ├── rag.py        # RAG functionality with ChromaDB
│   ├── llm.py        # LLM interaction and streaming
│   ├── tools.py      # Available tools for the AI
│   └── config.py     # Configuration management
├── requirements.txt  # Dependencies
└── Dockerfile        # Containerization
```

## Getting Started

### Prerequisites
- Python 3.8+
- PostgreSQL database
- Redis server (for caching)
- Ollama (for local LLM inference) or API keys for OpenAI/DashScope

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set up environment variables in `.env` file:
   ```
   SECRET_KEY=your_secret_key
   DATABASE_URL=postgresql://user:password@localhost/dbname
   REDIS_URL=redis://localhost:6379/0
   OPENAI_API_KEY=your_openai_api_key
   DASHSCOPE_API_KEY=your_dashscope_api_key
   LLM_PROVIDER=openai  # or dashscope, or ollama
   ```
4. Run the application:
   ```bash
   uvicorn backend.app.main:app --reload
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Chat
- `POST /api/chat/conversations` - Create conversation
- `GET /api/chat/conversations` - List conversations
- `GET /api/chat/conversations/{conv_id}/messages` - Get conversation messages
- `POST /api/chat/chat` - Send message and get streaming response

### File Analysis & Knowledge Base
- `POST /api/knowledge/analyze` - Analyze uploaded file and extract content (supports PDF, Word, Excel, text files)
- `GET /api/knowledge/supported-formats` - Get list of supported file formats with descriptions
- `POST /api/knowledge/create` - Create knowledge base
- `POST /api/knowledge/{kb_id}/upload` - Upload document to specific knowledge base
- `GET /api/knowledge/list` - List user's knowledge bases

## 中文文档

### 项目结构

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

### 技术栈

| 层级 | 技术 |
|------|------|
| **Web框架** | FastAPI + Uvicorn |
| **数据库** | PostgreSQL (asyncpg) + Redis |
| **ORM** | SQLAlchemy 2.0 (异步) |
| **认证** | JWT (python-jose) + bcrypt |
| **AI/LLM** | OpenAI GPT-3.5 / 阿里通义千问 |
| **向量库** | ChromaDB + LangChain |
| **PDF解析** | PyPDF2, python-docx, openpyxl |

### Docker 部署

```bash
docker-compose up --build
```

服务端口：
- **Backend**: `http://localhost:8000`
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

### 配置说明

在 `backend/.env` 中配置以下环境变量：

```env
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql+asyncpg://postgres:password@db:5432/aiassistant
REDIS_URL=redis://redis:6379/0
OPENAI_API_KEY=your-openai-api-key
LLM_PROVIDER=openai  # 或 dashscope, ollama
DASHSCOPE_API_KEY=your-dashscope-api-key
WEATHER_API_KEY=your-weather-api-key
```

## License

This project is licensed under the MIT License.