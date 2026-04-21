// 正确模拟前端处理逻辑
const fs = require('fs');

const rawData = fs.readFileSync('/tmp/clean_data.txt', 'utf8');
const lines = rawData.split('\n');

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

// 模拟前端处理
let messageContent = '';
let messageCount = 0;

console.log('=== 模拟前端实时显示 ===\n');

lines.forEach((line, index) => {
    // 移除行尾的\r
    const cleanLine = line.replace(/\r$/, '');
    
    if (!cleanLine.startsWith('data:')) return;
    
    const data = cleanLine.substring(5).trim();
    if (!data) return;
    
    const msg = extractContent(data, 'MESSAGE');
    if (msg !== null) {
        messageContent += msg;
        messageCount++;
        
        // 模拟实时显示 - 实时显示的内容
        const displayContent = escapeHtml(messageContent).replace(/\n/g, '<br>');
        
        // 只显示关键节点
        if (messageCount === 1 || messageCount === 10 || messageCount === 50 || messageCount === 100 || messageCount % 100 === 0) {
            console.log(`--- 第 ${messageCount} 个MESSAGE块 ---`);
            console.log('累积内容(前200字符):', displayContent.substring(0, 200));
            console.log('');
        }
    }
});

console.log('\n=== 最终结果 ===');
console.log('总MESSAGE块数:', messageCount);
console.log('最终累积长度:', messageContent.length);
console.log('\n最终内容(前500字符):');
console.log(messageContent.substring(0, 500));
console.log('\n最终内容(代码部分-从java开始):');
const codeStart = messageContent.indexOf('java');
if (codeStart >= 0) {
    console.log(messageContent.substring(codeStart, codeStart + 400));
}