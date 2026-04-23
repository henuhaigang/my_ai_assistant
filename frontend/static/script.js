// 全局状态
var token = localStorage.getItem('token');
var currentFile = null;
var currentFilePath = sessionStorage.getItem('filePath');
var isUploading = false;
var isAnalyzing = false;
var isLoading = false;
var abortController = null;
var hasFile = sessionStorage.getItem('hasFileUploaded') === 'true';
// 对话管理
var currentConversationId = null;
var conversations = [];

// 配置 marked
if (typeof marked !== 'undefined') {
    marked.setOptions({breaks: true, gfm: true});
}

// 页面加载
document.addEventListener('DOMContentLoaded', function() {
    var inputEl = document.getElementById('input');
    if (inputEl) {
        inputEl.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
        inputEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (isLoading) return;
                sendMessage();
            }
        });
    }
    
    var fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            var file = e.target.files[0];
            if (file) uploadFile(file);
        });
    }
    
    if (token) {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('chat-container').style.display = 'flex';
        setInputEnabled(true);
        loadConversations();
    }
});

function handleLoginKeyPress(e) {
    if (e.key === 'Enter') login();
}

function login() {
    var username = document.getElementById('username').value;
    var password = document.getElementById('password').value;
    
    var formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: formData
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        token = data.access_token;
        localStorage.setItem('token', token);
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('chat-container').style.display = 'flex';
        setInputEnabled(true);
        loadConversations();
    })
    .catch(function(err) { alert('登录失败'); });
}

function logout() {
    localStorage.removeItem('token');
    location.reload();
}

// 加载对话列表
async function loadConversations() {
    try {
        var res = await fetch('/api/chat/conversations', {
            headers: {'Authorization': 'Bearer ' + token}
        });
        if (!res.ok) return;
        conversations = await res.json();
        renderConversationList();
    } catch (e) {
        console.error('加载对话列表失败:', e);
    }
}

// 渲染侧边栏对话列表
function renderConversationList() {
    var listEl = document.getElementById('conversation-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    conversations.forEach(function(conv) {
        var item = document.createElement('div');
        item.className = 'conversation-item' + (conv.id === currentConversationId ? ' active' : '');
        item.onclick = function() { selectConversation(conv.id); };

        var titleEl = document.createElement('span');
        titleEl.className = 'conversation-title';
        titleEl.textContent = conv.title || '新对话';
        titleEl.onclick = function(e) { e.stopPropagation(); selectConversation(conv.id); };

        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'conversation-item-delete';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = '删除对话';
        deleteBtn.onclick = function(e) { e.stopPropagation(); deleteConversation(conv.id); };

        item.appendChild(titleEl);
        item.appendChild(deleteBtn);
        listEl.appendChild(item);
    });
}

// 选择对话
async function selectConversation(convId) {
    currentConversationId = convId;
    renderConversationList();
    clearMessagesArea();
    
    try {
        var res = await fetch('/api/chat/conversations/' + convId + '/messages', {
            headers: {'Authorization': 'Bearer ' + token}
        });
        if (!res.ok) return;
        var messages = await res.json();
        messages.forEach(function(msg) {
            addMessage(msg.role, msg.content);
        });
    } catch (e) {
        console.error('加载消息失败:', e);
    }
}

// 新建对话
function newConversation() {
    currentConversationId = null;
    renderConversationList();
    clearMessagesArea();
}

// 删除对话
async function deleteConversation(convId) {
    if (!confirm('确定要删除这个对话吗？')) return;
    try {
        var res = await fetch('/api/chat/conversations/' + convId, {
            method: 'DELETE',
            headers: {'Authorization': 'Bearer ' + token}
        });
        if (res.ok) {
            if (currentConversationId === convId) {
                currentConversationId = null;
                clearMessagesArea();
            }
            loadConversations();
        }
    } catch (e) {
        console.error('删除对话失败:', e);
    }
}

// 清空消息区域并显示欢迎消息
function clearMessagesArea() {
    var messagesArea = document.getElementById('messages-area');
    messagesArea.innerHTML = '';
    var welcome = document.createElement('div');
    welcome.className = 'welcome-message';
    welcome.innerHTML = '<div class="welcome-icon"><svg viewBox="0 0 80 80" width="80" height="80"><circle cx="40" cy="40" r="36" fill="#3B82F6" opacity="0.1"/><circle cx="40" cy="40" r="24" fill="#3B82F6" opacity="0.2"/><path d="M28 48 L40 28 L52 48" stroke="#3B82F6" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h2>你好，我是 AI 助手</h2><p>我可以帮助你分析文档内容。请先上传文件，然后我会提取内容，你可以问我任何关于文档的问题。</p><div class="feature-list"><div class="feature-item"><span class="feature-icon">📄</span><span>支持 PDF、Word、TXT 文档</span></div><div class="feature-item"><span class="feature-icon">💬</span><span>智能问答互动</span></div><div class="feature-item"><span class="feature-icon">📝</span><span>内容摘要总结</span></div></div>';
    messagesArea.appendChild(welcome);
}

// 上传文件
function uploadFile(file) {
    console.log('Uploading:', file.name);
    isUploading = true;
    setInputEnabled(false);
    
    document.getElementById('file-preview').style.display = 'flex';
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-size').textContent = formatSize(file.size);
    document.getElementById('upload-progress').style.display = 'flex';
    
    updateProgress(0);
    
    var formData = new FormData();
    formData.append('file', file);
    
    var progressInterval = setInterval(function() {
        var current = parseInt(document.getElementById('progress-text').textContent);
        if (current < 90) updateProgress(current + 5);
    }, 100);
    
    fetch('/api/files/upload', {
        method: 'POST',
        headers: {'Authorization': 'Bearer ' + token},
        body: formData
    })
    .then(function(res) {
        clearInterval(progressInterval);
        updateProgress(100);
        return res.json();
    })
.then(function(data) {
        console.log('Upload success:', data, 'Setting hasFile=true');
        currentFilePath = data.file_path;
        hasFile = true;
        isUploading = false;
        sessionStorage.setItem('filePath', currentFilePath);
        sessionStorage.setItem('hasFileUploaded', 'true');
        console.log('After upload: hasFile=', hasFile, 'currentFilePath=', currentFilePath, 'isUploading=', isUploading);
        
        setTimeout(function() {
            document.getElementById('upload-progress').style.display = 'none';
            document.getElementById('waiting-analysis').style.display = 'flex';
            
            setTimeout(function() {
                document.getElementById('waiting-analysis').style.display = 'none';
                setInputEnabled(true);
                addMessage('assistant', '📄 文件已上传成功！你可以问我关于这个文档的问题。\n\n例如：总结内容，主要观点等');
            }, 800);
        }, 300);
    })
    .catch(function(err) {
        clearInterval(progressInterval);
        alert('上传失败: ' + err.message);
        resetState();
    });
}

function updateProgress(percent) {
    var circle = document.querySelector('.progress-circle');
    var text = document.getElementById('progress-text');
    if (circle) circle.style.strokeDashoffset = 251.2 - (percent / 100) * 251.2;
    if (text) text.textContent = percent + '%';
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function removeFile() {
    currentFile = null;
    currentFilePath = null;
    hasFile = false;
    sessionStorage.removeItem('filePath');
    sessionStorage.removeItem('hasFileUploaded');
    document.getElementById('file-input').value = '';
    resetState();
}

function resetState() {
    document.getElementById('file-preview').style.display = 'none';
    document.getElementById('upload-progress').style.display = 'none';
    document.getElementById('waiting-analysis').style.display = 'none';
    updateProgress(0);
    setInputEnabled(true);
}

function setInputEnabled(enabled) {
    var input = document.getElementById('input');
    var sendBtn = document.getElementById('send-btn');
    if (input) {
        input.disabled = !enabled;
        input.placeholder = enabled ? (hasFile ? '请输入关于文档的问题...' : '问我任何问题...') : '等待中...';
    }
    if (sendBtn) sendBtn.disabled = !enabled;
}

// 切换发送按钮为暂停/停止状态
function setSendButtonPause(isPaused) {
    var sendBtn = document.getElementById('send-btn');
    if (!sendBtn) return;
    
    if (isPaused) {
        sendBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
        sendBtn.title = '停止生成';
        sendBtn.style.background = '#EF4444';
    } else {
        sendBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
        sendBtn.title = '发送';
        sendBtn.style.background = '';
    }
}

// 取消当前聊天请求
function cancelChat() {
    if (abortController) {
        abortController.abort();
    }
}

// 发送消息
function sendMessage() {
    if (isLoading) {
        // 正在加载，执行暂停操作
        cancelChat();
        return;
    }
    
    if (isUploading || isAnalyzing) return;
    
    var inputEl = document.getElementById('input');
    var message = inputEl.value.trim();
    if (!message) return;
    
    isLoading = true;
    abortController = new AbortController();
    setSendButtonPause(true);
    
    // 添加用户消息
    addMessage('user', message);
    inputEl.value = '';
    inputEl.style.height = 'auto';
    
    // 创建助手消息框
    var messagesArea = document.getElementById('messages-area');
    var wrapper = document.createElement('div');
    wrapper.className = 'message assistant';
    wrapper.innerHTML = '<div class="message-avatar">AI</div><div class="message-content">正在思考...</div>';
    messagesArea.appendChild(wrapper);
    var contentEl = wrapper.querySelector('.message-content');
    messagesArea.scrollTop = messagesArea.scrollHeight;
    
    // 根据消息类型选择 API
    var isFileRelated = hasFile && (
        message.includes('总结') || 
        message.includes('分析') || 
        message.includes('文档') || 
        message.includes('文件') ||
        message.includes('这个') ||
        message.includes('内容')
    );
    
    var apiUrl = isFileRelated ? '/api/files/chat' : '/api/chat/chat';
    var formData = new URLSearchParams();
    formData.append('message', message);
    
    if (currentConversationId) {
        formData.append('conversation_id', currentConversationId);
    }
    
    if (isFileRelated && currentFilePath) {
        formData.append('file_path', currentFilePath);
    }
    
    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData,
        signal: abortController.signal
    })
    .then(function(res) {
        if (!res.ok) return res.text().then(function(t) { throw new Error(t); });
        return res.json();
    })
    .then(async function(data) {
        var response = data.response || data;

        // 如果后端返回了 conversation_id，更新当前对话
        if (data.conversation_id) {
            currentConversationId = data.conversation_id;
            await loadConversations();
        }

        // 渲染 markdown
        try {
            contentEl.innerHTML = marked ? marked.parse(response) : escapeHtml(response);
        } catch (e) {
            contentEl.innerHTML = escapeHtml(response);
        }

        contentEl.style.wordWrap = 'break-word';
        contentEl.style.overflowWrap = 'break-word';
    })
    .catch(function(err) {
        if (err.name === 'AbortError') {
            contentEl.innerHTML = '<span style="color: #9CA3AF;">已停止生成</span>';
        } else {
            console.error('Error:', err);
            contentEl.innerHTML = '❌ 错误：' + err.message;
        }
    })
    .finally(function() {
        isLoading = false;
        abortController = null;
        setSendButtonPause(false);
    });
}

function addMessage(role, content) {
    var messagesArea = document.getElementById('messages-area');
    var welcome = messagesArea.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    var wrapper = document.createElement('div');
    wrapper.className = 'message ' + role;
    
    var avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? 'U' : 'AI';
    wrapper.appendChild(avatar);
    
    var contentHtml;
    try {
        contentHtml = marked ? marked.parse(content) : escapeHtml(content);
    } catch (e) {
        contentHtml = escapeHtml(content);
    }
    
    var contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content';
    contentWrapper.innerHTML = contentHtml;
    wrapper.appendChild(contentWrapper);
    
    messagesArea.appendChild(wrapper);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function escapeHtml(text) {
    var map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'};
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}