// 调试 - 检查实际数据
const fs = require('fs');

const rawData = fs.readFileSync('/tmp/clean_data.txt', 'utf8');
const lines = rawData.split('\n');

console.log('=== 检查第100行附近的MESSAGE数据 ===');
for (let i = 95; i < 110; i++) {
    if (lines[i]) {
        const line = lines[i].replace(/\r$/, '');
        console.log(`Line ${i}:`, line);
        console.log('  startsWith data:', line.startsWith('data:'));
        if (line.startsWith('data:')) {
            const data = line.substring(5).trim();
            console.log('  data:', data);
            console.log('  includes [MESSAGE]:', data.includes('[MESSAGE]'));
        }
    }
}