"use strict";
let token = localStorage.getItem('token');
let currentConvId = null;
let isLoading = false;
const input = document.getElementById('input');
if (input) {
    input.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
}
function handleLoginKeyPress(e) {
    if (e.key === 'Enter') {
        login();
    }
}
function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
        e.preventDefault();
        sendMessage();
    }
}
async function login() {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const username = usernameInput?.value || '';
    const password = passwordInput?.value || '';
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
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        if (res.ok) {
            const data = await res.json();
            token = data.access_token;
            if (token) {
                localStorage.setItem('token', token);
            }
            showChat();
            loadConversations();
        }
        else {
            alert('登录失败，请检查用户名和密码');
        }
    }
    catch (err) {
        alert('登录失败: ' + err.message);
    }
}
function logout() {
    localStorage.removeItem('token');
    token = null;
    currentConvId = null;
    const loginContainer = document.getElementById('login-container');
    const chatContainer = document.getElementById('chat-container');
    const messagesArea = document.getElementById('messages-area');
    if (loginContainer)
        loginContainer.style.display = 'flex';
    if (chatContainer)
        chatContainer.style.display = 'none';
    if (messagesArea) {
        messagesArea.innerHTML = `
            <div class="welcome-message">
                <h2>👋 欢迎使用 AI 助手</h2>
                <p>我是您的智能对话助手，可以回答问题、编写代码、创作内容等。有什么我可以帮您的吗？</p>
            </div>
        `;
    }
}
function showChat() {
    const loginContainer = document.getElementById('login-container');
    const chatContainer = document.getElementById('chat-container');
    if (loginContainer)
        loginContainer.style.display = 'none';
    if (chatContainer)
        chatContainer.style.display = 'flex';
}
async function loadConversations() {
    try {
        const res = await fetch('/api/chat/conversations', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const convs = await res.json();
        if (convs.length) {
            currentConvId = convs[0].id;
            loadMessages(convs[0].id);
        }
    }
    catch (err) {
        console.error('Failed to load conversations:', err);
    }
}
async function loadMessages(convId) {
    console.log('Loading messages for conversation:', convId);
}
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function addMessage(role, content, thinking = '') {
    const messagesArea = document.getElementById('messages-area');
    if (!messagesArea)
        return null;
    const welcome = messagesArea.querySelector('.welcome-message');
    if (welcome)
        welcome.remove();
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
        }
        else {
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
function toggleThinking(el) {
    const content = el.querySelector('.thinking-content');
    if (!content)
        return;
    if (el.classList.contains('expanded')) {
        el.classList.remove('expanded');
        el.classList.add('collapsed');
        content.classList.add('hidden');
    }
    else {
        el.classList.remove('collapsed');
        el.classList.add('expanded');
        content.classList.remove('hidden');
    }
}
async function sendMessage() {
    const inputEl = document.getElementById('input');
    if (!inputEl)
        return;
    const msg = inputEl.value.trim();
    if (!msg || isLoading)
        return;
    inputEl.value = '';
    inputEl.style.height = '48px';
    isLoading = true;
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn)
        sendBtn.disabled = true;
    addMessage('user', msg, '');
    const messagesArea = document.getElementById('messages-area');
    if (!messagesArea)
        return;
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
    const thinkingContentEl = thinkingEl?.querySelector('.thinking-content');
    if (!contentEl || !thinkingEl || !thinkingContentEl)
        return;
    thinkingEl.style.display = 'block';
    thinkingEl.classList.remove('collapsed');
    thinkingEl.classList.add('expanded');
    thinkingContentEl.textContent = '🤔 思考中...';
    let thinkingContent = '';
    let messageContent = '';
    let isInThinking = false;
    let thinkingAnimationInterval;
    let thinkingScrollInterval;
    let dots = 0;
    thinkingAnimationInterval = window.setInterval(() => {
        dots = (dots + 1) % 4;
        const dotsStr = '.'.repeat(dots);
        if (isInThinking) {
            contentEl.textContent = '思考中' + dotsStr;
        }
    }, 300);
    thinkingScrollInterval = window.setInterval(() => {
        if (thinkingContentEl.scrollHeight > thinkingEl.clientHeight) {
            thinkingEl.scrollTop = thinkingEl.scrollHeight - thinkingEl.clientHeight;
        }
    }, 100);
    try {
        const systemPromptInput = document.getElementById('system-prompt');
        const res = await fetch('/api/chat/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                conversation_id: currentConvId,
                message: msg,
                system_prompt: systemPromptInput?.value || null
            })
        });
        if (!res.ok) {
            throw new Error('请求失败');
        }
        const reader = res.body?.getReader();
        if (!reader) {
            throw new Error('无法获取响应流');
        }
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.startsWith('data:'))
                    continue;
                const data = line.substring(5).trim();
                if (!data)
                    continue;
                if (data.startsWith('[THINKING]') && data.endsWith('[/THINKING]')) {
                    isInThinking = true;
                    const startTag = '[THINKING]';
                    const endTag = '[/THINKING]';
                    const startIdx = data.indexOf(startTag) + startTag.length;
                    const endIdx = data.indexOf(endTag);
                    const thinkingText = data.substring(startIdx, endIdx);
                    thinkingContent += thinkingText;
                    thinkingContentEl.textContent = '🤔 思考中...\n' + thinkingContent;
                    contentEl.textContent = '思考中' + '.'.repeat(dots);
                    messagesArea.scrollTop = messagesArea.scrollHeight;
                }
                else if (data.startsWith('[MESSAGE]') && data.endsWith('[/MESSAGE]')) {
                    isInThinking = false;
                    const startTag = '[MESSAGE]';
                    const endTag = '[/MESSAGE]';
                    const startIdx = data.indexOf(startTag) + startTag.length;
                    const endIdx = data.indexOf(endTag);
                    const messageText = data.substring(startIdx, endIdx);
                    messageContent += messageText;
                    contentEl.textContent = messageContent;
                    if (thinkingContent.trim()) {
                        thinkingContentEl.textContent = '🤔 思考中...\n' + thinkingContent;
                    }
                    else {
                        thinkingEl.style.display = 'none';
                    }
                    messagesArea.scrollTop = messagesArea.scrollHeight;
                }
            }
        }
        if (thinkingAnimationInterval)
            clearInterval(thinkingAnimationInterval);
        if (thinkingScrollInterval)
            clearInterval(thinkingScrollInterval);
        if (thinkingContent.trim()) {
            thinkingContentEl.textContent = '🤔 思考中...\n' + thinkingContent.trim();
            thinkingEl.scrollTop = thinkingEl.scrollHeight;
        }
        else {
            thinkingEl.style.display = 'none';
        }
        contentEl.textContent = messageContent.trim();
    }
    catch (err) {
        if (thinkingAnimationInterval)
            clearInterval(thinkingAnimationInterval);
        if (thinkingScrollInterval)
            clearInterval(thinkingScrollInterval);
        thinkingEl.style.display = 'none';
        contentEl.textContent = '抱歉，发生了错误: ' + err.message;
        contentEl.style.color = '#ff3b30';
    }
    finally {
        isLoading = false;
        if (sendBtn)
            sendBtn.disabled = false;
    }
}
if (token) {
    showChat();
    loadConversations();
}
