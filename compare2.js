// 完整模拟前端处理 - 修正版
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

// 处理SSE流 - 模拟前端的buffer处理
const buffer = rawData;
const lines = buffer.split('\n');

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

console.log('总MESSAGE块数:', messageCount);
console.log('累积后总字符数:', messageContent.length);

// 对比: 原始API MESSAGE内容
// 原始提取方式: grep "\[MESSAGE\]" | sed 's/^data: //' | sed 's/\[MESSAGE\]//g' | sed 's/\[\/MESSAGE\]//g'
// 这个提取方式是把所有行连接起来

// 让我用正确方式提取原始内容
const originalLines = rawData.split('\n').filter(l => l.includes('[MESSAGE]'));
let originalContent = '';
originalLines.forEach(line => {
    const msg = extractContent(line.substring(5).trim(), 'MESSAGE');
    if (msg !== null) {
        originalContent += msg;
    }
});

console.log('\n=== 对比原始提取 ===');
console.log('原始提取字符数:', originalContent.length);
console.log('前端处理字符数:', messageContent.length);
console.log('是否一致:', originalContent === messageContent ? '✓' : '✗');

// 如果不一致，找出差异
if (originalContent !== messageContent) {
    console.log('\n=== 差异分析 ===');
    // 检查是否只是换行符差异
    const norm1 = originalContent.replace(/\n/g, '');
    const norm2 = messageContent.replace(/\n/g, '');
    console.log('去掉换行后是否一致:', norm1 === norm2 ? '✓' : '✗');
    
    if (norm1 !== norm2) {
        // 详细对比
        for (let i = 0; i < Math.min(norm1.length, norm2.length); i++) {
            if (norm1[i] !== norm2[i]) {
                console.log(`第一个差异位置: ${i}`);
                console.log(`原始: "${norm1.substring(i, i+20)}"`);
                console.log(`处理后: "${norm2.substring(i, i+20)}"`);
                break;
            }
        }
    }
}

// 显示最终内容样本
console.log('\n=== 最终累积内容(前300字符) ===');
console.log(messageContent.substring(0, 300));

console.log('\n=== 从"java"开始的内容(前300字符) ===');
const javaIdx = messageContent.indexOf('java');
if (javaIdx >= 0) {
    console.log(messageContent.substring(javaIdx, javaIdx + 300));
}