// Type definitions
interface User {
    id: number;
    username: string;
    email: string;
}

interface Conversation {
    id: number;
    user_id: number;
    title: string;
    created_at: string;
    updated_at?: string;
}

interface Message {
    role: MessageRole;
    content: string;
    created_at?: string;
}

interface LoginResponse {
    access_token: string;
    token_type: string;
}

interface ChatRequest {
    conversation_id: number | null;
    message: string;
    use_knowledge_base?: boolean;
    knowledge_base_id?: number | null;
    system_prompt?: string | null;
}

interface MessageElement {
    wrapper: HTMLElement;
    contentEl: HTMLElement | null;
    thinkingEl: HTMLElement | null;
}

interface ParsedContent {
    thinking: string;
    message: string;
}

type MessageRole = 'user' | 'assistant' | 'system';

// Global state
let token: string | null = localStorage.getItem('token');
let currentConvId: number | null = null;
let isLoading: boolean = false;

// Configure marked for code highlighting
declare const marked: any;
declare const hljs: any;

if (typeof marked !== 'undefined') {
    marked.setOptions({
        breaks: true,
        gfm: true,
        highlight: function(code: string, lang: string) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
                } catch (e) {
                    console.error('Highlight error:', e);
                }
            }
            return hljs.highlightAuto(code).value;
        }
    });
}

// Auto-resize textarea
const input = document.getElementById('input') as HTMLTextAreaElement | null;
if (input) {
    input.addEventListener('input', function(this: HTMLTextAreaElement) {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
}

// Handle Enter key for login
function handleLoginKeyPress(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
        login();
    }
}

// Handle Enter key for chat
function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
        e.preventDefault();
        sendMessage();
    }
}

// Login
async function login(): Promise<void> {
    const usernameInput = document.getElementById('username') as HTMLInputElement | null;
    const passwordInput = document.getElementById('password') as HTMLInputElement | null;
    
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
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: formData
        });
        
        if (res.ok) {
            const data: LoginResponse = await res.json();
            token = data.access_token;
            if (token) {
                localStorage.setItem('token', token);
            }
            showChat();
            loadConversations();
        } else {
            alert('登录失败，请检查用户名和密码');
        }
    } catch (err) {
        alert('登录失败: ' + (err as Error).message);
    }
}

// Logout
function logout(): void {
    localStorage.removeItem('token');
    token = null;
    currentConvId = null;
    const loginContainer = document.getElementById('login-container');
    const chatContainer = document.getElementById('chat-container');
    const messagesArea = document.getElementById('messages-area');
    
    if (loginContainer) loginContainer.style.display = 'flex';
    if (chatContainer) chatContainer.style.display = 'none';
    if (messagesArea) {
        messagesArea.innerHTML = `
            <div class="welcome-message">
                <h2>👋 欢迎使用 AI 助手</h2>
                <p>我是您的智能对话助手，可以回答问题、编写代码、创作内容等。有什么我可以帮您的吗？</p>
            </div>
        `;
    }
}

// Show chat
function showChat(): void {
    const loginContainer = document.getElementById('login-container');
    const chatContainer = document.getElementById('chat-container');
    
    if (loginContainer) loginContainer.style.display = 'none';
    if (chatContainer) chatContainer.style.display = 'flex';
}

// Load conversations
async function loadConversations(): Promise<void> {
    try {
        const res = await fetch('/api/chat/conversations', {
            headers: {'Authorization': `Bearer ${token}`}
        });
        const convs: Conversation[] = await res.json();
        if (convs.length) {
            currentConvId = convs[0].id;
            loadMessages(convs[0].id);
        }
    } catch (err) {
        console.error('Failed to load conversations:', err);
    }
}

// Parse historical message content - 分离thinking和message
function parseHistoricalContent(content: string): ParsedContent {
    let thinking = '';
    let message = content;
    
    // 提取所有[THINKING]内容
    const thinkingRegex = /\[THINKING\]([\s\S]*?)\[\/THINKING\]/g;
    let match;
    const thinkingParts: string[] = [];
    
    while ((match = thinkingRegex.exec(content)) !== null) {
        thinkingParts.push(match[1]);
    }
    
    if (thinkingParts.length > 0) {
        thinking = thinkingParts.join('');
        // 移除所有thinking标签，只保留实际内容
        message = content.replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/g, '');
    }
    
    // 移除[MESSAGE]标签
    message = message.replace(/\[MESSAGE\]/g, '').replace(/\[\/MESSAGE\]/g, '');
    
    // 清理message内容
    message = message.trim();
    
    return { thinking, message };
}

// Load messages for a conversation
async function loadMessages(convId: number): Promise<void> {
    try {
        const res = await fetch(`/api/chat/conversations/${convId}/messages`, {
            headers: {'Authorization': `Bearer ${token}`}
        });
        const messages: Message[] = await res.json();
        
        const messagesArea = document.getElementById('messages-area');
        if (!messagesArea) return;
        
        // Clear welcome message
        const welcome = messagesArea.querySelector('.welcome-message');
        if (welcome) welcome.remove();
        
        messages.forEach(msg => {
            if (msg.role === 'assistant') {
                // 对于助手消息，解析thinking和message
                const parsed = parseHistoricalContent(msg.content);
                addMessage(msg.role, parsed.message, parsed.thinking);
            } else {
                addMessage(msg.role, msg.content, '');
            }
        });
    } catch (err) {
        console.error('Failed to load messages:', err);
    }
}

// Escape HTML - 转义HTML特殊字符
function escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m: string) => map[m]);
}

// Render markdown with syntax highlighting
function renderMarkdown(content: string): string {
    if (!content || content.trim() === '') {
        return '';
    }
    
    try {
        if (typeof marked !== 'undefined') {
            // 解析Markdown - marked会在解析时自动调用highlight函数
            const html = marked.parse(content);
            return html;
        }
    } catch (e) {
        console.error('Markdown render error:', e);
    }
    // 如果marked不可用，返回转义后的文本
    return escapeHtml(content).replace(/\n/g, '<br>');
}

// Add message to UI
function addMessage(role: MessageRole, content: string, thinking: string = ''): MessageElement | null {
    const messagesArea = document.getElementById('messages-area');
    if (!messagesArea) return null;
    
    // Remove welcome message if exists
    const welcome = messagesArea.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role}`;
    
    const avatar = role === 'user' ? 'U' : 'AI';
    
    // 对助手消息使用Markdown渲染
    let contentHtml: string;
    if (role === 'assistant') {
        contentHtml = renderMarkdown(content);
    } else {
        contentHtml = escapeHtml(content || '').replace(/\n/g, '<br>');
    }
    
    let thinkingHtml = '';
    if (role === 'assistant') {
        if (thinking && thinking.trim()) {
            const thinkingEscaped = escapeHtml(thinking).replace(/\n/g, '<br>');
            thinkingHtml = `
                <div class="thinking-box expanded" onclick="toggleThinking(this)">
                    <span class="thinking-content">🤔 思考中...<br>${thinkingEscaped}</span>
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
            <div class="message-content">${contentHtml}<span class="cursor"></span></div>
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
function toggleThinking(el: HTMLElement): void {
    const content = el.querySelector('.thinking-content') as HTMLElement | null;
    if (!content) return;
    
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

// Extract content from tagged message
function extractContent(data: string, tag: string): string | null {
    const startTag = `[${tag}]`;
    const endTag = `[/${tag}]`;
    
    if (data.includes(startTag) && data.includes(endTag)) {
        const startIdx = data.indexOf(startTag) + startTag.length;
        const endIdx = data.indexOf(endTag);
        return data.substring(startIdx, endIdx);
    }
    return null;
}

// Send message
async function sendMessage(): Promise<void> {
    const inputEl = document.getElementById('input') as HTMLTextAreaElement | null;
    if (!inputEl) return;
    
    const msg = inputEl.value.trim();
    
    if (!msg || isLoading) return;
    
    // Clear input immediately
    inputEl.value = '';
    inputEl.style.height = '48px';
    
    isLoading = true;
    const sendBtn = document.getElementById('send-btn') as HTMLButtonElement | null;
    if (sendBtn) sendBtn.disabled = true;
    
    // Add user message
    addMessage('user', msg, '');
    
    // Create wrapper for assistant response
    const messagesArea = document.getElementById('messages-area');
    if (!messagesArea) return;
    
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
    
    const contentEl = wrapper.querySelector('.message-content') as HTMLElement | null;
    const thinkingEl = wrapper.querySelector('.thinking-box') as HTMLElement | null;
    const thinkingContentEl = thinkingEl?.querySelector('.thinking-content') as HTMLElement | null;
    
    if (!contentEl || !thinkingEl || !thinkingContentEl) return;
    
    // Show thinking indicator
    thinkingEl.style.display = 'block';
    thinkingEl.classList.remove('collapsed');
    thinkingEl.classList.add('expanded');
    thinkingContentEl.textContent = '🤔 思考中...';
    
    // Initialize accumulators
    let thinkingContent = '';
    let messageContent = '';
    let isInThinking = false;
    let thinkingAnimationInterval: number | undefined;
    let thinkingScrollInterval: number | undefined;
    
    // Start thinking animation
    let dots = 0;
    thinkingAnimationInterval = window.setInterval(() => {
        dots = (dots + 1) % 4;
        if (isInThinking) {
            contentEl.textContent = '思考中' + '.'.repeat(dots);
        }
    }, 300);
    
    // Start auto-scroll for thinking content
    thinkingScrollInterval = window.setInterval(() => {
        if (thinkingContentEl.scrollHeight > thinkingEl.clientHeight) {
            thinkingEl.scrollTop = thinkingEl.scrollHeight - thinkingEl.clientHeight;
        }
    }, 100);
    
    try {
        const systemPromptInput = document.getElementById('system-prompt') as HTMLInputElement | null;
        
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
            const {done, value} = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, {stream: true});
            
            // Process complete SSE events
            let lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (!line.startsWith('data:')) continue;
                
                const data = line.substring(5).trim();
                if (!data) continue;
                
                // Check for THINKING tag
                const thinkingMatch = extractContent(data, 'THINKING');
                if (thinkingMatch !== null) {
                    isInThinking = true;
                    thinkingContent += thinkingMatch;
                    
                    const thinkingEscaped = escapeHtml(thinkingContent).replace(/\n/g, '<br>');
                    thinkingContentEl.innerHTML = '🤔 思考中...<br>' + thinkingEscaped;
                    contentEl.textContent = '思考中' + '.'.repeat(dots);
                    messagesArea.scrollTop = messagesArea.scrollHeight;
                    continue;
                }
                
                // Check for MESSAGE tag
                const messageMatch = extractContent(data, 'MESSAGE');
                if (messageMatch !== null) {
                    isInThinking = false;
                    messageContent += messageMatch;
                    
                    // 实时显示：保留换行，用innerHTML显示
                    contentEl.innerHTML = escapeHtml(messageContent).replace(/\n/g, '<br>');
                    
                    // Update thinking if has content
                    if (thinkingContent.trim()) {
                        const thinkingEscaped = escapeHtml(thinkingContent).replace(/\n/g, '<br>');
                        thinkingContentEl.innerHTML = '🤔 思考中...<br>' + thinkingEscaped;
                    } else {
                        thinkingEl.style.display = 'none';
                    }
                    
                    messagesArea.scrollTop = messagesArea.scrollHeight;
                    continue;
                }
                
                // Handle raw error messages
                if (data.startsWith('Error:')) {
                    throw new Error(data.substring(6));
                }
            }
        }
        
        // Stop animations
        if (thinkingAnimationInterval) clearInterval(thinkingAnimationInterval);
        if (thinkingScrollInterval) clearInterval(thinkingScrollInterval);
        
        // Final rendering
        if (thinkingContent.trim()) {
            const thinkingEscaped = escapeHtml(thinkingContent).replace(/\n/g, '<br>');
            thinkingContentEl.innerHTML = '🤔 思考中...<br>' + thinkingEscaped;
            thinkingEl.scrollTop = thinkingEl.scrollHeight;
        } else {
            thinkingEl.style.display = 'none';
        }
        
        // Final markdown render
        const finalHtml = renderMarkdown(messageContent.trim());
        contentEl.innerHTML = finalHtml;
        
    } catch (err) {
        if (thinkingAnimationInterval) clearInterval(thinkingAnimationInterval);
        if (thinkingScrollInterval) clearInterval(thinkingScrollInterval);
        thinkingEl.style.display = 'none';
        contentEl.textContent = '抱歉，发生了错误: ' + (err as Error).message;
        contentEl.style.color = '#ff3b30';
    } finally {
        isLoading = false;
        if (sendBtn) sendBtn.disabled = false;
    }
}

// Check token on load
if (token) {
    showChat();
    loadConversations();
}
