// 调试数据处理
const fs = require('fs');

const rawData = fs.readFileSync('/tmp/clean_data.txt', 'utf8');
const lines = rawData.split('\n');

console.log('=== 检查前20行数据格式 ===');
lines.slice(0, 20).forEach((line, i) => {
    console.log(`Line ${i}:`, JSON.stringify(line));
});

console.log('\n=== 检查包含MESSAGE的行 ===');
let msgLines = lines.filter(l => l.includes('[MESSAGE]'));
console.log('包含[MESSAGE]的行数:', msgLines.length);
console.log('前5行:');
msgLines.slice(0, 5).forEach(l => console.log(JSON.stringify(l)));