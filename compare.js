// 完整模拟前端处理并对比
const fs = require('fs');

const rawData = fs.readFileSync('/tmp/api_raw.txt', 'utf8');

function extractContent(data, tag) {
    const startTag = '[' + tag + ']';
    const endTag = '[/' + tag + ']';
    
    if (data.includes(startTag) && data.includes(endTag)) {
        const startIdx = data.indexOf(startTag) + startTag.length;
        const endIdx = data.indexOf(endTag);
        return data.substring(startIdx, endIdx);
    }
    return null;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// 处理SSE流
const lines = rawData.split('\n');
let messageContent = '';
let messageCount = 0;

console.log('=== 模拟前端处理 ===\n');

lines.forEach(line => {
    if (!line.startsWith('data:')) return;
    
    const data = line.substring(5).trim();
    if (!data) return;
    
    const msg = extractContent(data, 'MESSAGE');
    if (msg !== null) {
        messageContent += msg;
        messageCount++;
    }
});

console.log('处理后的总字符数:', messageContent.length);
console.log('总MESSAGE块数:', messageCount);

// 对比1: 原始MESSAGE文件
const originalContent = fs.readFileSync('/tmp/api_messages.txt', 'utf8');
console.log('\n=== 对比1: 原始提取内容 ===');
console.log('原始文件字符数:', originalContent.length);
console.log('处理后字符数:', messageContent.length);
console.log('是否一致:', originalContent === messageContent ? '✓ 一致' : '✗ 不一致');

// 对比2: 检查关键内容
console.log('\n=== 对比2: 关键内容检查 ===');
console.log('原始包含"java":', originalContent.includes('java'));
console.log('处理后包含"java":', messageContent.includes('java'));

// 检查代码部分
const originalCode = originalContent.substring(originalContent.indexOf('java'));
const processedCode = messageContent.substring(messageContent.indexOf('java'));

console.log('\n=== 对比3: 代码部分(从java开始) ===');
console.log('原始代码前200字符:', originalCode.substring(0, 200));
console.log('处理后代码前200字符:', processedCode.substring(0, 200));

// 对比4: 逐字符比较
console.log('\n=== 对比4: 详细对比 ===');
let diffCount = 0;
const maxLen = Math.max(originalContent.length, messageContent.length);
for (let i = 0; i < maxLen; i++) {
    if (originalContent[i] !== messageContent[i]) {
        diffCount++;
        if (diffCount <= 5) {
            console.log(`位置${i} 原始: "${originalContent[i]}" (${originalContent.charCodeAt(i)}) 处理后: "${messageContent[i]}" (${messageContent.charCodeAt(i)})`);
        }
    }
}
console.log('总差异字符数:', diffCount);

// 对比5: 模拟实时显示 (innerHTML)
console.log('\n=== 对比5: 模拟实时显示 ===');
const realtimeDisplay = escapeHtml(messageContent).replace(/\n/g, '<br>');
console.log('实时显示内容(前500字符):');
console.log(realtimeDisplay.substring(0, 500));