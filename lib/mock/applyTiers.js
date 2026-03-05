const fs = require('fs');
const path = require('path');

const filePath = path.join('d:', '工程系統', 'lib', 'mock', 'department_flows.ts');
let content = fs.readFileSync(filePath, 'utf8');

const updated = content.replace(/"base_offset_days":\s*(-?\d+)(,*)/g, (match, daysStr, comma) => {
    const days = parseInt(daysStr, 10);
    return `"base_offset_days": ${days},
                "kw_tiers": [
                    { "maxKW": 20, "days": ${days} },
                    { "maxKW": 100, "days": ${days} },
                    { "maxKW": 300, "days": ${days} },
                    { "maxKW": 500, "days": ${days} },
                    { "maxKW": 999999, "days": ${days} }
                ]${comma}`;
});

fs.writeFileSync(filePath, updated, 'utf8');
console.log('Replaced');
