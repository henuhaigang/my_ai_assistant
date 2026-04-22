// 全局状态
var token = localStorage.getItem('token');
var currentFile = null;
var currentFilePath = sessionStorage.getItem('filePath');
var isUploading = false;
var isAnalyzing = false;
var isLoading = false;
var hasFile = sessionStorage.getItem('hasFileUploaded') === 'true';

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
    })
    .catch(function(err) { alert('登录失败'); });
}

function logout() {
    localStorage.removeItem('token');
    location.reload();
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

// 发送消息
function sendMessage() {
    console.log('sendMessage called', {hasFile: hasFile, currentFilePath: currentFilePath, isLoading: isLoading});
    if (isUploading || isAnalyzing || isLoading) return;
    
    var inputEl = document.getElementById('input');
    var message = inputEl.value.trim();
    if (!message) return;
    
    // 检查消息是否与文档相关
    var isFileRelated = hasFile && (
        message.includes('总结') || 
        message.includes('分析') || 
        message.includes('文档') || 
        message.includes('文件') ||
        message.includes('这个') ||
        message.includes('内容')
    );
    
    console.log('Message:', message, 'isFileRelated:', isFileRelated);
    
    isLoading = true;
    setInputEnabled(false);
    
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
    
    if (isFileRelated && currentFilePath) {
        formData.append('file_path', currentFilePath);
    }
    
    console.log('Selected API:', apiUrl);
    
    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
    })
    .then(function(res) {
        console.log('Response status:', res.status);
        if (!res.ok) return res.text().then(function(t) { throw new Error(t); });
        return res.json();
    })
    .then(function(data) {
        var response = data.response || data;
        
        // 清理响应
        response = response.replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/g, '');
        response = response.replace(/\[MESSAGE\]/g, '').replace(/\[\/MESSAGE\]/g, '');
        
        // 渲染 markdown
        try {
            contentEl.innerHTML = marked ? marked.parse(response) : escapeHtml(response);
        } catch (e) {
            contentEl.innerHTML = escapeHtml(response);
        }
        
        // 确保内容不溢出
        contentEl.style.wordWrap = 'break-word';
        contentEl.style.overflowWrap = 'break-word';
    })
    .catch(function(err) {
        console.error('Error:', err);
        contentEl.innerHTML = '❌ 错误：' + err.message;
    })
    .finally(function() {
        isLoading = false;
        setInputEnabled(true);
    });
}

function addMessage(role, content) {
    var messagesArea = document.getElementById('messages-area');
    var welcome = messagesArea.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    var wrapper = document.createElement('div');
    wrapper.className = 'message ' + role;
    wrapper.style.maxWidth = '100%';
    wrapper.style.width = '100%';
    wrapper.style.boxSizing = 'border-box';
    
    var contentHtml;
    try {
        contentHtml = marked ? marked.parse(content) : escapeHtml(content);
    } catch (e) {
        contentHtml = escapeHtml(content);
    }
    
    var contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content';
    contentWrapper.style.wordWrap = 'break-word';
    contentWrapper.style.overflowWrap = 'break-word';
    contentWrapper.style.maxWidth = '100%';
    contentWrapper.style.width = '100%';
    contentWrapper.style.boxSizing = 'border-box';
    contentWrapper.innerHTML = contentHtml;
    
    wrapper.innerHTML = '<div class="message-avatar">' + (role === 'user' ? 'U' : 'AI') + '</div>';
    wrapper.appendChild(contentWrapper);
    
    messagesArea.appendChild(wrapper);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function escapeHtml(text) {
    var map = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'};
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}