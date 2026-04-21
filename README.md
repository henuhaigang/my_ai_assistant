# AI Assistant Application

An AI assistant application with chat, knowledge base, and RAG capabilities built with FastAPI.

## Features

- **Chat Functionality**: 
  - Conversation management (create/list/get messages)
  - Streaming chat responses using Server-Sent Events
  - Context preservation in conversations
  - System prompt support

- **Knowledge Base Management**:
  - Create and manage knowledge bases
  - Document upload (PDF and text files)
  - Vector-based retrieval using ChromaDB

- **RAG (Retrieval-Augmented Generation)**:
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

### Knowledge Base
- `POST /api/knowledge/create` - Create knowledge base
- `POST /api/knowledge/{kb_id}/upload` - Upload document to knowledge base
- `GET /api/knowledge/list` - List user's knowledge bases

## License

This project is licensed under the MIT License.