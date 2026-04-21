# 文件上传与分析 API 使用指南

## 概述

本应用支持多种类型的文件上传和分析功能，包括自动内容提取、元数据收集和向量存储。

## 支持的文件格式

| 格式 | 扩展名 | 说明 |
|------|--------|------|
| PDF文档 | `.pdf` | 可读取所有页面文本内容 |
| Word文档 | `.docx`, `.doc` | 提取段落、单词数量等元数据 |
| Excel表格 | `.xlsx`, `.xls` | 获取工作表信息（仅支持.xlsx格式） |
| 文本文件 | `.txt`, `.md`, `.json`, `.xml` | 直接读取文本内容 |

## API 端点

### 1. 分析上传的文件

**端点**: `POST /api/knowledge/analyze`

**描述**: 上传任意类型的文件，系统会自动分析并提取可读的内容。

**请求格式**: multipart/form-data

**参数说明**:
- `file`: 必需。要分析的文件（二进制数据）
- `kb_name`: 可选。如果需要将内容存储到知识库中
- `store_to_kb`: 布尔值，默认为 false。
  - 如果设为 true 且提供了 kb_name，分析后的文本将被添加到指定的向量数据库集合

```json
{
  "success": false,
  "error": "Empty file uploaded or unsupported format",
  "filename": "unknown.pdf",
  "file_type": null
}
```

### 使用 cURL 示例

#### 基本文件分析（不存储到知识库）

```bash
curl -X POST "http://localhost:8000/api/knowledge/analyze" \
  -F "file=@example.pdf"
```

#### 分析并存储到指定知识库

```bash
curl -X POST "http://localhost:8000/api/knowledge/analyze?kb_name=my_analysis&store_to_kb=true" \
  -F "file=@report.docx"
```

### 使用 JavaScript/Fetch 示例

```javascript
// 基本文件分析
async function analyzeFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/knowledge/analyze', {
            method: 'POST',
            body: formData,
            
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        return await response.json();
    } catch (error) {
        console.error('Error analyzing file:', error);
        throw error;
    }
}

// 分析并存储到知识库
async function analyzeAndStore(file, kbName = 'my_kb') {
    const formData = new FormData();
    formData.append('file', file);
    
    // 添加查询参数（通过URL）
    const url = `/api/knowledge/analyze?kb_name=${encodeURIComponent(kbName)}&store_to_kb=true`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        return await response.json();
    } catch (error) {
        console.error('Error analyzing and storing file:', error);
        throw error;
    }
}

// 使用示例
const pdfFile = document.getElementById('fileInput').files[0];
analyzeAndStore(pdfFile, 'my_analysis_kb');
```

### 2. 获取支持的文件格式

**端点**: `GET /api/knowledge/supported-formats`

**描述**: 查看系统支持的所有文件类型及其详细信息。

**响应示例**:

```json
{
  "formats": [
    {
      ".pdf": {"name": "PDF Document", "description": "Portable Document Format"}
    },
    {
      ".docx": {"name": "Word Document (.docx)", "description": "Microsoft Word document format"}
    }
  ],
  "max_size_mb": 10,
  "note": "Files larger than max size will be rejected"
}
```

### 前端集成示例

#### HTML 表单实现

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>文件上传与分析</title>
    <style>
        .upload-container {
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            
        }
        
        input[type="file"] {
            width: 100%;
            margin-bottom: 15px;
            
        }
    </style>
</head>
<body>
    
<div class="upload-container">
    <h2>文件上传与分析系统</h2>
    
    <div>
        <label for="kbName">知识库名称（可选）:</label><br>
        <input type="text" id="kbName" placeholder="例如: my_analysis_kb"><br>
        
        <label style="margin-top: 10px;">
            <input type="checkbox" id="storeToKb">
            存储到知识库
        </label>
    </div>
    
    <div>
        <label for="fileInput">选择文件:</label><br>
        <input type="file" id="fileInput"><br>
        
<button onclick="analyzeFile()">分析并上传</button>
<div id="result"></div>
    </div>

<script src="script.js">
// JavaScript 代码在 script.js 中实现
```

#### TypeScript 实现

```typescript
interface FileAnalysisResult {
    success: boolean;
    filename?: string;
    content_type?: string;
    size_bytes?: number;
    extracted_text?: string;
    metadata?: any;
}

export async function analyzeFile(file: File, kbName?: string): Promise<FileAnalysisResult> {
    
    const formData = new FormData();
    formData.append('file', file);
    
    // 构建查询参数
    let url = '/api/knowledge/analyze';
    if (kbName) {
        url += `?kb_name=${encodeURIComponent(kbName)}&store_to_kb=true`;
        
    }
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        return await response.json();
    } catch (error) {
        console.error('Error analyzing file:', error);
        throw error;
    }
}

// 使用示例
const analyzeBtn = document.getElementById('analyze-btn');
if (analyzeBtn) {
    
    const kbNameInput = document.getElementById('kb-name') as HTMLInputElement;
    const storeToKbCheckbox = document.getElementById('store-to-kb') as HTMLInputElement;
    
    fileSelect.addEventListener('change', () => {
        if (fileSelect.files && fileSelect.files[0]) {
            analyzeBtn.disabled = false;
            
    });
}

analyzeBtn?.addEventListener('click', async () => {
    const selectedFile = fileInput.files?.[0];
    if (!selectedFile) return alert('请选择一个文件');
    
    try {
        // 显示加载状态
        resultDiv.textContent = '正在分析...';
        
        await analyzeAndStore(selectedFile, kbName);
        
        resultDiv.innerHTML = `
            <div class="success">
                分析成功！<br>
                文件名: ${result.filename}<br>
                大小: ${(result.size_bytes / 1024).toFixed(2)} KB
            </div>
            
    } catch (error) {
        console.error('Error:', error);
        
```

## 错误处理

### 常见错误代码和说明

| 状态码 | 说明 |
|--------|------|
| 400 Bad Request | 文件为空或不支持的格式 |
| 413 Payload Too Large | 文件大小超过限制（默认10MB） |
| 401 Unauthorized | 未认证的用户尝试访问 |

### 错误响应示例

```json
{
    "success": false,
    "error": "File too large. Maximum allowed size is 10MB",
    "filename": "large_file.pdf"
}
```

## 性能优化建议

1. **文件大小限制**: 建议设置合理的最大上传文件大小（默认为10MB）
2. **内容截断**: 对于大型文档，只返回前10000个字符的文本
3. **异步处理**: 考虑使用后台任务队列来处理大文件的向量存储

## 安全注意事项

1. 验证用户身份和权限
2. 限制文件类型以防止恶意上传
3. 对提取的内容进行适当的清理和处理