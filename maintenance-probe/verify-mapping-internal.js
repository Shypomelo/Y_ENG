const fs = require('fs');
const path = require('path');

const PROJECTS_PATH = path.join(__dirname, 'probe-output', 'console', 'project-records.normalized.json');
const REPORTS_PATH = path.join(__dirname, 'probe-output', 'console', 'maintenance-reports.normalized.json');
const HISTORICAL_NORTH_IN_PROGRESS_SUBSET_PATH = path.join(
    __dirname,
    'probe-output',
    'console',
    'north-reports.normalized.json'
);

function loadJson(p) {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const projectsJson = loadJson(PROJECTS_PATH);
const reportsJson = loadJson(REPORTS_PATH);

if (!projectsJson || !reportsJson) {
    console.error('Error: Required JSON files missing.');
    process.exit(1);
}

const projects = projectsJson.data;
const reports = reportsJson.data;

const stats = {
    total_reports: reports.length,
    matched_by_no: 0,
    matched_by_name_exact: 0,
    matched_by_name_fuzzy: 0,
    unmatched: 0,
    success_rate: 0,
    samples: {
        matched: [],
        unmatched: []
    }
};

const processedReports = reports.map(r => {
    const col0 = (r.region || '').split('\n');
    const actualRegion = (col0[0] || '').trim();
    const actualCaseName = (col0[1] || '').trim();
    const actualCaseNo = (col0[2] || '').trim();

    const col1 = (r.case_name || '').split('\n');
    const reportTime = (col1[0] || '').trim();
    const reportIssue = (col1[2] || '').trim();

    // Mapping attempt
    let matchedProject = null;
    let matchedBy = 'unmatched';

    // 1. Case No Match (Normalized: remove first char if it's a letter, vs exact)
    const normNo = actualCaseNo.replace(/^[A-Z]/, '');
    matchedProject = projects.find(p => {
        const pNo = (p.case_no || '').trim();
        const pNoNorm = pNo.replace(/^[A-Z]/, '');
        return pNo === actualCaseNo || (normNo.length > 5 && pNoNorm === normNo);
    });

    if (matchedProject) {
        matchedBy = 'case_no';
        stats.matched_by_no++;
    } else {
        // 2. Case Name Match (Exact)
        matchedProject = projects.find(p => (p.case_name || '').trim() === actualCaseName);
        if (matchedProject) {
            matchedBy = 'case_name (exact)';
            stats.matched_by_name_exact++;
        } else {
            // 3. Case Name Match (Fuzzy: Substring)
            matchedProject = projects.find(p => {
                const pName = (p.case_name || '').trim();
                return pName.length > 2 && (actualCaseName.includes(pName) || pName.includes(actualCaseName));
            });
            if (matchedProject) {
                matchedBy = 'case_name (fuzzy)';
                stats.matched_by_name_fuzzy++;
            } else {
                stats.unmatched++;
            }
        }
    }

    const reportData = {
        actual_case_no: actualCaseNo,
        actual_case_name: actualCaseName,
        actual_region: actualRegion,
        report_time: reportTime,
        report_issue: reportIssue,
        matched_by: matchedBy,
        matched_project: matchedProject ? {
            case_no: matchedProject.case_no,
            case_name: matchedProject.case_name,
            address: matchedProject.address,
            project_status: matchedProject.project_status
        } : null
    };

    if (matchedBy !== 'unmatched' && stats.samples.matched.length < 10) {
        stats.samples.matched.push(reportData);
    } else if (matchedBy === 'unmatched' && stats.samples.unmatched.length < 10) {
        stats.samples.unmatched.push(reportData);
    }

    return reportData;
});

stats.success_rate = ((stats.matched_by_no + stats.matched_by_name_exact + stats.matched_by_name_fuzzy) / stats.total_reports * 100).toFixed(2) + '%';

const modelRecommendation = {
    case_no: "reports (Col 0, Line 2)",
    case_name: "reports (Col 0, Line 1)",
    region: "reports (Col 0, Line 0)",
    report_time: "reports (Col 1, Line 0)",
    report_issue: "reports (Col 1, Line 2)",
    repair_status: "reports (Col 4, Line 0)",
    address: "projects (Lookup by case_no/name)",
    site_contact_name: "future (Not found in current extraction)",
    site_contact_phone: "future (Not found in current extraction)"
};

const result = {
    file_evidence: {
        projects: { path: PROJECTS_PATH, rows: projects.length },
        reports: { path: REPORTS_PATH, rows: reports.length }
    },
    mapping_stats: stats,
    model_recommendation: modelRecommendation
};

fs.writeFileSync('mapping-check.json', JSON.stringify(result, null, 2));

// Generate Markdown
let md = `# Mapping Check Report\n\n`;
md += `## A. File Evidence\n`;
md += `| File | Path | Total Rows |\n| :--- | :--- | :--- |\n`;
md += `| Projects | ${PROJECTS_PATH} | ${projects.length} |\n`;
md += `| Reports | ${REPORTS_PATH} | ${reports.length} |\n\n`;

md += `## C. Mapping Statistics\n`;
md += `| Category | Count |\n| :--- | :--- |\n`;
md += `| Total Reports | ${stats.total_reports} |\n`;
md += `| Matched by case_no | ${stats.matched_by_no} |\n`;
md += `| Matched by case_name (Exact) | ${stats.matched_by_name_exact} |\n`;
md += `| Matched by case_name (Fuzzy) | ${stats.matched_by_name_fuzzy} |\n`;
md += `| Unmatched | ${stats.unmatched} |\n`;
md += `| **Success Rate** | **${stats.success_rate}** |\n\n`;

md += `## D. Evidence Samples\n`;
md += `### Success Samples\n`;
md += `| Report No | Report Name | Matched No | Matched Name | By |\n| :--- | :--- | :--- | :--- | :--- |\n`;
stats.samples.matched.forEach(s => {
    md += `| ${s.actual_case_no} | ${s.actual_case_name} | ${s.matched_project.case_no} | ${s.matched_project.case_name} | ${s.matched_by} |\n`;
});

md += `\n### Failure Samples\n`;
md += `| Report No | Report Name | Status |\n| :--- | :--- | :--- |\n`;
stats.samples.unmatched.forEach(s => {
    md += `| ${s.actual_case_no} | ${s.actual_case_name} | Unmatched |\n`;
});

md += `\n## E. Layout Recommendation\n`;
md += `| Field | Source | Note |\n| :--- | :--- | :--- |\n`;
Object.entries(modelRecommendation).forEach(([k, v]) => md += `| ${k} | ${v} | |\n`);

fs.writeFileSync('mapping-check.md', md);
