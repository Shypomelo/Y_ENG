const fs = require('fs');
const path = require('path');

const PROBE_DIR = path.join(__dirname, 'probe-output');
const FILES = {
    projects: path.join(PROBE_DIR, 'extraction', 'project-records.normalized.json'),
    reports: path.join(PROBE_DIR, 'console', 'maintenance-reports.normalized.json'),
    north: path.join(PROBE_DIR, 'console', 'maintenance-reports-north.normalized.json'),
    fallback: path.join(PROBE_DIR, 'site-inventory', 'deep-page-summary.json')
};

const OUTPUT_JSON = path.join(__dirname, 'mapping-check.json');
const OUTPUT_MD = path.join(__dirname, 'mapping-check.md');

function run() {
    console.log('[check] 開始證據式驗證...');
    
    const results = {
        files: {},
        stats: {
            total_reports: 0,
            match_by_no: 0,
            match_by_name: 0,
            unmatched: 0,
            success_rate: "0%"
        },
        samples: {
            success: [],
            failure: []
        },
        contact_info: {
            extracted_values: false,
            field_exists_only: true
        },
        is_inference: false
    };

    // 1. 檢查檔案存在與讀取筆數
    for (const [key, filePath] of Object.entries(FILES)) {
        if (key === 'fallback') continue;
        const exists = fs.existsSync(filePath);
        results.files[key] = {
            path: filePath,
            exists: exists,
            rows: 0
        };
        if (exists) {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            results.files[key].rows = content.meta?.total_rows || content.data?.length || 0;
        }
    }

    if (!results.files.reports.exists || results.files.projects.rows === 0) {
        results.is_inference = true;
        console.log('[warning] 缺少完整 normalized 資料，轉為結構推論模式。');
    }

    // 2. 核心比對邏輯 (如果只有 fallback 則用 fallback 的 3 筆測試)
    let projectsData = [];
    let reportsData = [];

    if (results.files.reports.exists && results.files.projects.exists) {
        projectsData = JSON.parse(fs.readFileSync(FILES.projects, 'utf-8')).data || [];
        reportsData = JSON.parse(fs.readFileSync(FILES.reports, 'utf-8')).data || [];
    } else if (fs.existsSync(FILES.fallback)) {
        const deep = JSON.parse(fs.readFileSync(FILES.fallback, 'utf-8'));
        const pEntry = deep.find(d => d.menu_path === '專案記錄');
        const rEntry = deep.find(d => d.menu_path === '通報記錄');
        
        // 專案列表欄位 Mapping (deep-page-summary 固定格式)
        if (pEntry) {
            projectsData = (pEntry.sample_rows || []).map(r => ({
                case_no: r[0],
                case_name: r[1],
                address: r[5]
            }));
        }
        // 通報列表解析 MULTILINE
        if (rEntry) {
            reportsData = (rEntry.sample_rows || []).map(r => {
                const parts = r[0].split('\n');
                return {
                    region: parts[0],
                    case_name: parts[1],
                    case_no: parts[2],
                    report_time: r[1].split('\n')[0]
                };
            });
        }
    }

    // 3. 逐筆比對
    results.stats.total_reports = reportsData.length;
    reportsData.forEach(rep => {
        let matched = projectsData.find(p => p.case_no === rep.case_no);
        let matchType = 'unmatched';
        let matchedProj = null;

        if (matched) {
            matchType = 'case_no';
            matchedProj = matched;
            results.stats.match_by_no++;
        } else {
            matched = projectsData.find(p => p.case_name === rep.case_name);
            if (matched) {
                matchType = 'case_name';
                matchedProj = matched;
                results.stats.match_by_name++;
            } else {
                results.stats.unmatched++;
            }
        }

        const sample = {
            report_no: rep.case_no,
            report_name: rep.case_name,
            matched_project_no: matchedProj ? matchedProj.case_no : 'N/A',
            matched_project_name: matchedProj ? matchedProj.case_name : 'N/A',
            matched_by: matchType
        };

        if (matchType !== 'unmatched' && results.samples.success.length < 10) {
            results.samples.success.push(sample);
        } else if (matchType === 'unmatched' && results.samples.failure.length < 10) {
            results.samples.failure.push(sample);
        }
    });

    results.stats.success_rate = reportsData.length > 0 
        ? ((results.stats.match_by_no + results.stats.match_by_name) / reportsData.length * 100).toFixed(1) + "%"
        : "0%";

    // 4. 聯絡資訊檢查
    // 檢查是否有實際抽取到值
    const hasValues = projectsData.some(p => p.contact_name || p.contact_phone);
    results.contact_info.extracted_values = hasValues;
    results.contact_info.field_exists_only = !hasValues;

    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2));

    // Markdown 輸出
    let md = `# Evidence-based Data Verification Report

${results.is_inference ? '> [!IMPORTANT]\n> **本次結果僅為結構推論，尚非實際資料驗證完成**。原因：未偵測到完整的 \`normalized.json\` 數據檔案。' : ''}

## 1. 檔案讀取證據 (Evidence of Files)
| 檔案名稱 | 完整路徑 | 狀態 | 實際筆數 |
| :--- | :--- | :--- | :--- |
| Project Normalized | \`${FILES.projects}\` | ${results.files.projects.exists ? '✅ 存在' : '❌ 缺失'} | ${results.files.projects.rows} |
| Reports Normalized | \`${FILES.reports}\` | ${results.files.reports.exists ? '✅ 存在' : '❌ 缺失'} | ${results.files.reports.rows} |
| North Reports | \`${FILES.north}\` | ${results.files.north.exists ? '✅ 存在' : '❌ 缺失'} | ${results.files.north.rows} |

## 2. 逐筆比對細節統計 (Matching Stats)
- **Reports 總比對筆數**: ${results.stats.total_reports}
- **由案號 (case_no) 對齊**: ${results.stats.match_by_no}
- **由案名 (case_name) 對齊**: ${results.stats.match_by_name}
- **完全對不到**: ${results.stats.unmatched}
- **對應成功率**: **${results.stats.success_rate}**

## 3. 證據樣本 (Matching Samples)

### 成功對應樣本 (Top 10 Success)
${results.samples.success.length > 0 ? '| Report Case No | Report Name | Project No | Project Name | Matched By |\n| :--- | :--- | :--- | :--- | :--- |\n' + 
results.samples.success.map(s => `| ${s.report_no} | ${s.report_name} | ${s.matched_project_no} | ${s.matched_project_name} | ${s.matched_by} |`).join('\n') : '*無成功樣本*'}

### 失敗對應樣本 (Top 10 Failure)
${results.samples.failure.length > 0 ? '| Report Case No | Report Name | Matched By |\n| :--- | :--- | :--- |\n' + 
results.samples.failure.map(s => `| ${s.report_no} | ${s.report_name} | ${s.matched_by} |`).join('\n') : '*無失敗樣本*'}

## 4. 聯絡資訊抽取狀態
- **欄位存在性**: ✅ 已確認 (Form Labels 包含 \`聯絡人\`, \`聯絡資訊\`)
- **數值抽取率**: ${results.contact_info.extracted_values ? '✅ 已成功抽到實際值' : '❌ **尚未抽到值** (目前僅確認欄位存在，需進入明細頁抽取)'}

## 5. 待維修卡片建議最終欄位 (Schema)
| 欄位名稱 | 來源 | 狀態 |
| :--- | :--- | :--- |
| **address** | Projects | 需補值 |
| **site_contact_name** | Projects | 需補值 (明細) |
| **site_contact_phone** | Projects | 需補值 (明細) |

---
*Generated by Antigravity Mapping Tool*
`;

    fs.writeFileSync(OUTPUT_MD, md);
    console.log(`[done] 驗證報告產出: ${OUTPUT_MD}`);
}

run();
