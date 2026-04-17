let token = localStorage.getItem('token');
let currentConvId = null;
let isLoading = false;

// Auto-resize textarea
const input = document.getElementById('input');
input.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Handle Enter key for login
function handleLoginKeyPress(e) {
    if (e.key === 'Enter') {
        login();
    }
}

// Handle Enter key for chat
function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
        e.preventDefault();
        sendMessage();
    }
}

// Login
async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        alert('请输入用户名和密码');
        return;
    }
    
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: formData
        });
        
        if (res.ok) {
            const data = await res.json();
            token = data.access_token;
            localStorage.setItem('token', token);
            showChat();
            loadConversations();
        } else {
            alert('登录失败，请检查用户名和密码');
        }
    } catch (err) {
        alert('登录失败: ' + err.message);
    }
}

// Logout
function logout() {
    localStorage.removeItem('token');
    token = null;
    currentConvId = null;
    document.getElementById('login-container').style.display = 'flex';
    document.getElementById('chat-container').style.display = 'none';
    document.getElementById('messages-area').innerHTML = `
        <div class="welcome-message">
            <h2>👋 欢迎使用 AI 助手</h2>
            <p>我是您的智能对话助手，可以回答问题、编写代码、创作内容等。有什么我可以帮您的吗？</p>
        </div>
    `;
}

// Show chat
function showChat() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'flex';
}

// Load conversations
async function loadConversations() {
    try {
        const res = await fetch('/api/chat/conversations', {
            headers: {'Authorization': `Bearer ${token}`}
        });
        const convs = await res.json();
        if (convs.length) {
            currentConvId = convs[0].id;
            loadMessages(convs[0].id);
        }
    } catch (err) {
        console.error('Failed to load conversations:', err);
    }
}

// Load messages for a conversation
async function loadMessages(convId) {
    // TODO: Implement message history loading
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add message to UI
function addMessage(role, content, thinking = '') {
    const messagesArea = document.getElementById('messages-area');
    
    // Remove welcome message if exists
    const welcome = messagesArea.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role}`;
    
    const avatar = role === 'user' ? 'U' : 'AI';
    
    let thinkingHtml = '';
    if (role === 'assistant') {
        if (thinking) {
            thinkingHtml = `
                <div class="thinking-box expanded" onclick="toggleThinking(this)">
                    <span class="thinking-content">🤔 思考中...\n${escapeHtml(thinking)}</span>
                </div>
            `;
        } else {
            thinkingHtml = `
                <div class="thinking-box collapsed" id="thinking-placeholder" style="display:none;">
                    <span class="thinking-content">🤔 思考中...</span>
                </div>
            `;
        }
    }
    
    wrapper.innerHTML = `
        <div class="message-avatar ${role}">${avatar}</div>
        <div class="message-content-wrapper">
            ${thinkingHtml}
            <div class="message-content">${escapeHtml(content)}<span class="cursor"></span></div>
        </div>
    `;
    
    messagesArea.appendChild(wrapper);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    
    return {
        wrapper,
        contentEl: wrapper.querySelector('.message-content'),
        thinkingEl: wrapper.querySelector('.thinking-box')
    };
}

// Toggle thinking box
function toggleThinking(el) {
    const content = el.querySelector('.thinking-content');
    if (el.classList.contains('expanded')) {
        el.classList.remove('expanded');
        el.classList.add('collapsed');
        content.classList.add('hidden');
    } else {
        el.classList.remove('collapsed');
        el.classList.add('expanded');
        content.classList.remove('hidden');
    }
}

// Send message
async function sendMessage() {
    const inputEl = document.getElementById('input');
    const msg = inputEl.value.trim();
    
    if (!msg || isLoading) return;
    
    // Clear input immediately
    inputEl.value = '';
    inputEl.style.height = '48px';
    
    isLoading = true;
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;
    
    // Add user message
    addMessage('user', msg, '');
    
    // Create wrapper for assistant response
    const messagesArea = document.getElementById('messages-area');
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper assistant';
    wrapper.innerHTML = `
        <div class="message-avatar assistant">AI</div>
        <div class="message-content-wrapper">
            <div class="thinking-box collapsed" style="display: none;" onclick="toggleThinking(this)">
                <span class="thinking-content"></span>
            </div>
            <div class="message-content"></div>
        </div>
    `;
    messagesArea.appendChild(wrapper);
    
    const contentEl = wrapper.querySelector('.message-content');
    const thinkingEl = wrapper.querySelector('.thinking-box');
    const thinkingContentEl = thinkingEl.querySelector('.thinking-content');
    
    // Show thinking indicator while waiting
    thinkingEl.style.display = 'block';
    thinkingEl.classList.remove('collapsed');
    thinkingEl.classList.add('expanded');
    thinkingContentEl.textContent = '🤔 思考中...';
    
    // Initialize variables
    let thinkingContent = '';
    let messageContent = '';
    let isInThinking = false;
    let thinkingAnimationInterval;
    let thinkingScrollInterval;
    
    // Start thinking animation
    let dots = 0;
    thinkingAnimationInterval = setInterval(() => {
        dots = (dots + 1) % 4;
        const dotsStr = '.'.repeat(dots);
        if (isInThinking) {
            // Show thinking animation in message-content
            contentEl.textContent = '思考中' + dotsStr;
        }
    }, 300);
    
    // Start auto-scroll for thinking content
    thinkingScrollInterval = setInterval(() => {
        if (thinkingContentEl.scrollHeight > thinkingEl.clientHeight) {
            // 内容超出容器高度，自动向上滚动
            thinkingEl.scrollTop = thinkingEl.scrollHeight - thinkingEl.clientHeight;
        }
    }, 100);
    
    try {
        const res = await fetch('/api/chat/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                conversation_id: currentConvId,
                message: msg,
                system_prompt: document.getElementById('system-prompt').value || null
            })
        });
        
        if (!res.ok) {
            throw new Error('请求失败');
        }
        
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, {stream: true});
            
            // Process all complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (!line.startsWith('data:')) continue;
                
                const data = line.substring(5).trim();
                if (!data) continue;
                
                // Check if data is a thinking block: [THINKING]xxx[/THINKING]
                if (data.startsWith('[THINKING]') && data.endsWith('[/THINKING]')) {
                    // Extract thinking content
                    isInThinking = true;
                    const startTag = '[THINKING]';
                    const endTag = '[/THINKING]';
                    const startIdx = data.indexOf(startTag) + startTag.length;
                    const endIdx = data.indexOf(endTag);
                    const thinkingText = data.substring(startIdx, endIdx);
                    thinkingContent += thinkingText;
                    
                    // Update thinking-content with thinking content
                    thinkingContentEl.textContent = '🤔 思考中...\n' + thinkingContent;
                    
                    // Show thinking animation in message-content
                    contentEl.textContent = '思考中' + '.'.repeat(dots);
                    
                    // Smooth scroll
                    messagesArea.scrollTop = messagesArea.scrollHeight;
                } 
                // Check if data is a message block: [MESSAGE]xxx[/MESSAGE]
                else if (data.startsWith('[MESSAGE]') && data.endsWith('[/MESSAGE]')) {
                    // Extract message content
                    isInThinking = false;
                    const startTag = '[MESSAGE]';
                    const endTag = '[/MESSAGE]';
                    const startIdx = data.indexOf(startTag) + startTag.length;
                    const endIdx = data.indexOf(endTag);
                    const messageText = data.substring(startIdx, endIdx);
                    messageContent += messageText;
                    
                    // Update message-content with final answer
                    contentEl.textContent = messageContent;
                    
                    // Update thinking-content if there's thinking content
                    if (thinkingContent.trim()) {
                        thinkingContentEl.textContent = '🤔 思考中...\n' + thinkingContent;
                    } else {
                        thinkingEl.style.display = 'none';
                    }
                    
                    // Smooth scroll
                    messagesArea.scrollTop = messagesArea.scrollHeight;
                }
            }
        }
        
        // Stop animations
        clearInterval(thinkingAnimationInterval);
        clearInterval(thinkingScrollInterval);
        
        // Final display
        if (thinkingContent.trim()) {
            thinkingContentEl.textContent = '🤔 思考中...\n' + thinkingContent.trim();
            // Reset scroll to show latest content
            thinkingEl.scrollTop = thinkingEl.scrollHeight;
        } else {
            thinkingEl.style.display = 'none';
        }
        
        // Final message-content display
        contentEl.textContent = messageContent.trim();
        
    } catch (err) {
        clearInterval(thinkingAnimationInterval);
        clearInterval(thinkingScrollInterval);
        thinkingEl.style.display = 'none';
        contentEl.textContent = '抱歉，发生了错误: ' + err.message;
        contentEl.style.color = '#ff3b30';
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
    }
}

// Check token on load
if (token) {
    showChat();
    loadConversations();
}