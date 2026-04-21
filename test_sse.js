// 直接模拟前端的实际处理逻辑
// 模拟接收到的原始SSE数据块

const fs = require('fs');

// 模拟原始SSE流 - 读取原始文件并解析
const rawSSE = fs.readFileSync('/tmp/chat_raw.txt', 'utf8');

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

// 模拟前端的buffer处理
const buffer = rawSSE;
const lines = buffer.split('\n');

let messageContent = '';
let count = 0;

console.log('=== 模拟前端处理 ===\n');

lines.forEach((line, idx) => {
    // 前端代码：if (!line.startsWith('data:')) continue;
    if (!line.startsWith('data:')) return;
    
    // 前端代码：const data = line.substring(5).trim();
    const data = line.substring(5).trim();
    if (!data) return;
    
    // 前端代码：const messageMatch = extractContent(data, 'MESSAGE');
    const msg = extractContent(data, 'MESSAGE');
    
    if (msg !== null) {
        messageContent += msg;
        count++;
        
        // 实时显示效果
        const display = messageContent.replace(/\n/g, '↵');
        
        if (count <= 5 || count === 10 || count === 20 || count % 50 === 0) {
            console.log(`[${count}] 累积: ${display.substring(0, 100)}...`);
        }
    }
});

console.log('\n=== 结果 ===');
console.log('总MESSAGE块:', count);
console.log('累积内容长度:', messageContent.length);
console.log('\n完整内容:');
console.log(messageContent);