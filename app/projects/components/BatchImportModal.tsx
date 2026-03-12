"use client";

import { useState, useCallback, useEffect } from "react";
import { fetchLookupDataAction } from "../import-actions";

// ---------------------
// Types
// ---------------------
type MappingTarget =
    | { table: "projects"; field: string; label: string }
    | { table: "project_steps"; stepName: string; dateType: "planned" | "actual" }
    | { table: "ignore" };

interface ColumnMapping {
    sourceColumn: string;
    target: MappingTarget;
    sampleValues: string[];
}

interface ProjectPreviewRow {
    rowIndex: number;
    name: string;
    kwp: number | null;
    engineer: string | null;
    engineerId: string | null;
    pm: string | null;
    pmId: string | null;
    sales: string | null;
    salesId: string | null;
    structure: string | null;
    structureId: string | null;
    admin: string | null;
    adminId: string | null;
    structureVendor: string | null;
    structureVendorId: string | null;
    electricalVendor: string | null;
    electricalVendorId: string | null;
    statusFlag: string | null;
    projectedMeterDate: string | null;
    warnings: string[];
}

interface StepPreviewRow {
    rowIndex: number;
    projectName: string;
    stepName: string;
    plannedDate: string | null;
    actualDate: string | null;
}

interface LookupData {
    staff: { id: string; name: string; department: string }[];
    vendors: { id: string; name: string; category: string }[];
    existingProjectNames: string[];
}

// ---------------------
// Auto-mapping rules
// ---------------------
const PROJECT_FIELD_RULES: { patterns: RegExp[]; field: string; label: string }[] = [
    { patterns: [/案場名稱/i, /案件名稱/i, /專案名稱/i, /project.?name/i, /^name$/i, /案名/i], field: "name", label: "案場名稱" },
    { patterns: [/容量/i, /kwp/i, /kw/i, /瓩/i], field: "kwp", label: "容量 kWp" },
    { patterns: [/工務/i, /工程/i, /engineer/i], field: "engineer_id", label: "工程人員" },
    { patterns: [/pm/i, /專案經理/i, /project.?manager/i], field: "project_manager_id", label: "PM" },
    { patterns: [/業務/i, /sales/i], field: "sales_id", label: "業務" },
    { patterns: [/結構/i, /structure_id/i], field: "structure_id", label: "結構人員" },
    { patterns: [/行政/i, /admin/i], field: "admin_id", label: "行政人員" },
    { patterns: [/支架廠商/i, /結構廠商/i, /structure.?vendor/i], field: "structure_vendor_id", label: "支架廠商" },
    { patterns: [/電力廠商/i, /electrical.?vendor/i, /電氣廠商/i], field: "electrical_vendor_id", label: "電力廠商" },
    { patterns: [/狀態/i, /status/i], field: "status_flag", label: "專案狀態" },
    { patterns: [/掛表日期/i, /掛表預計/i, /meter.?date/i, /projected.?meter/i], field: "projected_meter_date", label: "掛表日期" },
];

const STEP_DATE_PATTERNS = [
    /(.+?)[\s_]?預計完成日/,
    /(.+?)[\s_]?預計日/,
    /(.+?)[\s_]?計畫日/,
    /(.+?)[\s_]?planned/i,
    /(.+?)[\s_]?實際完成日/,
    /(.+?)[\s_]?實際日/,
    /(.+?)[\s_]?actual/i,
];

function detectStepColumn(colName: string): { stepName: string; dateType: "planned" | "actual" } | null {
    const actualPatterns = [/(.+?)[\s_]?實際完成日/, /(.+?)[\s_]?實際日/, /(.+?)[\s_]?actual/i];
    for (const p of actualPatterns) {
        const m = colName.match(p);
        if (m) return { stepName: m[1].trim(), dateType: "actual" };
    }
    const plannedPatterns = [/(.+?)[\s_]?預計完成日/, /(.+?)[\s_]?預計日/, /(.+?)[\s_]?計畫日/, /(.+?)[\s_]?planned/i];
    for (const p of plannedPatterns) {
        const m = colName.match(p);
        if (m) return { stepName: m[1].trim(), dateType: "planned" };
    }
    return null;
}

function autoMapColumn(colName: string, sampleValues: string[]): MappingTarget {
    // Check project fields first
    for (const rule of PROJECT_FIELD_RULES) {
        for (const p of rule.patterns) {
            if (p.test(colName)) {
                return { table: "projects", field: rule.field, label: rule.label };
            }
        }
    }
    // Check step date patterns
    const stepResult = detectStepColumn(colName);
    if (stepResult) {
        return { table: "project_steps", stepName: stepResult.stepName, dateType: stepResult.dateType };
    }
    return { table: "ignore" };
}

// ---------------------
// CSV Parser
// ---------------------
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else if (ch === '"') {
                    inQuotes = false;
                } else {
                    current += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ',') {
                    result.push(current.trim());
                    current = "";
                } else {
                    current += ch;
                }
            }
        }
        result.push(current.trim());
        return result;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    return { headers, rows };
}

// ---------------------
// Lookup helpers
// ---------------------
function findStaffId(name: string | null, lookup: LookupData): { id: string | null; found: boolean } {
    if (!name || !name.trim()) return { id: null, found: true };
    const match = lookup.staff.find(s => s.name === name.trim());
    return match ? { id: match.id, found: true } : { id: null, found: false };
}

function findVendorId(name: string | null, lookup: LookupData): { id: string | null; found: boolean } {
    if (!name || !name.trim()) return { id: null, found: true };
    const match = lookup.vendors.find(v => v.name === name.trim());
    return match ? { id: match.id, found: true } : { id: null, found: false };
}

// ---------------------
// Available system fields for dropdown
// ---------------------
const SYSTEM_FIELDS: { value: string; label: string; table: string }[] = [
    { value: "projects:name", label: "案場名稱", table: "projects" },
    { value: "projects:kwp", label: "容量 kWp", table: "projects" },
    { value: "projects:engineer_id", label: "工程人員", table: "projects" },
    { value: "projects:project_manager_id", label: "PM", table: "projects" },
    { value: "projects:sales_id", label: "業務", table: "projects" },
    { value: "projects:structure_id", label: "結構人員", table: "projects" },
    { value: "projects:admin_id", label: "行政人員", table: "projects" },
    { value: "projects:structure_vendor_id", label: "支架廠商", table: "projects" },
    { value: "projects:electrical_vendor_id", label: "電力廠商", table: "projects" },
    { value: "projects:status_flag", label: "專案狀態", table: "projects" },
    { value: "projects:projected_meter_date", label: "掛表日期", table: "projects" },
    { value: "ignore", label: "（不匯入）", table: "ignore" },
];

// =======================
// Component
// =======================
export default function BatchImportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<string[][]>([]);
    const [mappings, setMappings] = useState<ColumnMapping[]>([]);
    const [lookup, setLookup] = useState<LookupData | null>(null);
    const [isLoadingLookup, setIsLoadingLookup] = useState(false);
    const [fileName, setFileName] = useState("");

    // Preview states
    const [projectPreviews, setProjectPreviews] = useState<ProjectPreviewRow[]>([]);
    const [stepPreviews, setStepPreviews] = useState<StepPreviewRow[]>([]);
    const [unmappedColumns, setUnmappedColumns] = useState<string[]>([]);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setHeaders([]);
            setRows([]);
            setMappings([]);
            setLookup(null);
            setFileName("");
            setProjectPreviews([]);
            setStepPreviews([]);
            setUnmappedColumns([]);
        }
    }, [isOpen]);

    // ---- Step 1: File Upload ----
    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target?.result as string;
            const { headers: h, rows: r } = parseCSV(text);
            setHeaders(h);
            setRows(r);

            // Auto-map columns
            const autoMapped: ColumnMapping[] = h.map((col, idx) => {
                const samples = r.slice(0, 5).map(row => row[idx] || "");
                return {
                    sourceColumn: col,
                    target: autoMapColumn(col, samples),
                    sampleValues: samples,
                };
            });
            setMappings(autoMapped);
        };
        reader.readAsText(file, "UTF-8");
    }, []);

    // ---- Step 2 → Step 3: Generate Preview ----
    const generatePreview = useCallback(async () => {
        setIsLoadingLookup(true);
        try {
            const data = await fetchLookupDataAction();
            setLookup(data);

            // Build project previews
            const nameColIdx = mappings.findIndex(m => m.target.table === "projects" && (m.target as any).field === "name");

            const previews: ProjectPreviewRow[] = rows.map((row, ri) => {
                const pw: ProjectPreviewRow = {
                    rowIndex: ri + 2,
                    name: "",
                    kwp: null,
                    engineer: null, engineerId: null,
                    pm: null, pmId: null,
                    sales: null, salesId: null,
                    structure: null, structureId: null,
                    admin: null, adminId: null,
                    structureVendor: null, structureVendorId: null,
                    electricalVendor: null, electricalVendorId: null,
                    statusFlag: null,
                    projectedMeterDate: null,
                    warnings: [],
                };

                mappings.forEach((m, ci) => {
                    if (m.target.table !== "projects") return;
                    const val = row[ci] || "";
                    const field = (m.target as any).field;
                    switch (field) {
                        case "name": pw.name = val; break;
                        case "kwp": pw.kwp = parseFloat(val) || null; break;
                        case "engineer_id": {
                            pw.engineer = val;
                            const r = findStaffId(val, data);
                            pw.engineerId = r.id;
                            if (!r.found && val) pw.warnings.push(`工程「${val}」在人員表找不到`);
                            break;
                        }
                        case "project_manager_id": {
                            pw.pm = val;
                            const r = findStaffId(val, data);
                            pw.pmId = r.id;
                            if (!r.found && val) pw.warnings.push(`PM「${val}」在人員表找不到`);
                            break;
                        }
                        case "sales_id": {
                            pw.sales = val;
                            const r = findStaffId(val, data);
                            pw.salesId = r.id;
                            if (!r.found && val) pw.warnings.push(`業務「${val}」在人員表找不到`);
                            break;
                        }
                        case "structure_id": {
                            pw.structure = val;
                            const r = findStaffId(val, data);
                            pw.structureId = r.id;
                            if (!r.found && val) pw.warnings.push(`結構「${val}」在人員表找不到`);
                            break;
                        }
                        case "admin_id": {
                            pw.admin = val;
                            const r = findStaffId(val, data);
                            pw.adminId = r.id;
                            if (!r.found && val) pw.warnings.push(`行政「${val}」在人員表找不到`);
                            break;
                        }
                        case "structure_vendor_id": {
                            pw.structureVendor = val;
                            const r = findVendorId(val, data);
                            pw.structureVendorId = r.id;
                            if (!r.found && val) pw.warnings.push(`支架廠商「${val}」在廠商表找不到`);
                            break;
                        }
                        case "electrical_vendor_id": {
                            pw.electricalVendor = val;
                            const r = findVendorId(val, data);
                            pw.electricalVendorId = r.id;
                            if (!r.found && val) pw.warnings.push(`電力廠商「${val}」在廠商表找不到`);
                            break;
                        }
                        case "status_flag": pw.statusFlag = val; break;
                        case "projected_meter_date": pw.projectedMeterDate = val; break;
                    }
                });

                // Warnings
                if (!pw.name) pw.warnings.push("缺少案場名稱");
                if (pw.kwp === null) pw.warnings.push("缺少容量");
                if (data.existingProjectNames.includes(pw.name)) pw.warnings.push("可能重複（系統已有同名專案）");

                return pw;
            });

            setProjectPreviews(previews);

            // Build step previews
            const steps: StepPreviewRow[] = [];
            rows.forEach((row, ri) => {
                const projectName = nameColIdx >= 0 ? (row[nameColIdx] || `第${ri + 2}列`) : `第${ri + 2}列`;
                mappings.forEach((m, ci) => {
                    if (m.target.table !== "project_steps") return;
                    const val = row[ci] || "";
                    if (!val) return;
                    const t = m.target as { table: "project_steps"; stepName: string; dateType: "planned" | "actual" };
                    // Find or create entry
                    let existing = steps.find(s => s.rowIndex === ri + 2 && s.stepName === t.stepName);
                    if (!existing) {
                        existing = { rowIndex: ri + 2, projectName, stepName: t.stepName, plannedDate: null, actualDate: null };
                        steps.push(existing);
                    }
                    if (t.dateType === "planned") existing.plannedDate = val;
                    else existing.actualDate = val;
                });
            });
            setStepPreviews(steps);

            // Unmapped columns
            const unmapped = mappings.filter(m => m.target.table === "ignore").map(m => m.sourceColumn);
            setUnmappedColumns(unmapped);

            setStep(3);
        } catch (err: any) {
            alert(`載入參照資料失敗：\n${err.message}`);
        } finally {
            setIsLoadingLookup(false);
        }
    }, [mappings, rows]);

    // ---- Mapping change handler ----
    const handleMappingChange = (colIndex: number, value: string) => {
        setMappings(prev => {
            const next = [...prev];
            if (value === "ignore") {
                next[colIndex] = { ...next[colIndex], target: { table: "ignore" } };
            } else if (value.startsWith("projects:")) {
                const field = value.replace("projects:", "");
                const rule = PROJECT_FIELD_RULES.find(r => r.field === field);
                next[colIndex] = { ...next[colIndex], target: { table: "projects", field, label: rule?.label || field } };
            } else if (value.startsWith("step_planned:") || value.startsWith("step_actual:")) {
                const [prefix, stepName] = value.split(":", 2);
                next[colIndex] = {
                    ...next[colIndex],
                    target: { table: "project_steps", stepName, dateType: prefix === "step_planned" ? "planned" : "actual" }
                };
            }
            return next;
        });
    };

    if (!isOpen) return null;

    const projectMappedCount = mappings.filter(m => m.target.table === "projects").length;
    const stepMappedCount = mappings.filter(m => m.target.table === "project_steps").length;
    const ignoredCount = mappings.filter(m => m.target.table === "ignore").length;

    // Warning counts
    const warningRows = projectPreviews.filter(p => p.warnings.length > 0);
    const duplicateRows = projectPreviews.filter(p => p.warnings.some(w => w.includes("重複")));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative flex flex-col w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-800">
                {/* Header */}
                <div className="flex-none flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 bg-zinc-50 dark:bg-zinc-900/80">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">批次匯入專案</h2>
                        <div className="flex items-center gap-1">
                            {[1, 2, 3].map(s => (
                                <div key={s} className="flex items-center gap-1">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= s ? "bg-blue-600 text-white" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700"}`}>
                                        {s}
                                    </div>
                                    <span className={`text-xs font-medium mx-1 ${step >= s ? "text-blue-700 dark:text-blue-400" : "text-zinc-400"}`}>
                                        {s === 1 ? "上傳" : s === 2 ? "對照" : "預覽"}
                                    </span>
                                    {s < 3 && <div className={`w-6 h-0.5 ${step > s ? "bg-blue-400" : "bg-zinc-200 dark:bg-zinc-700"}`} />}
                                </div>
                            ))}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* ---- STEP 1: Upload ---- */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="text-center py-8">
                                <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                </div>
                                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-2">上傳 CSV 檔案</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">支援 UTF-8 編碼的 CSV 檔案，系統將解析表頭與資料列</p>
                                <label className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold cursor-pointer hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    選擇檔案
                                    <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                                </label>
                            </div>

                            {headers.length > 0 && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-5 space-y-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span className="font-bold text-emerald-800 dark:text-emerald-300">解析完成</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{rows.length}</div>
                                            <div className="text-xs text-zinc-500">資料列數</div>
                                        </div>
                                        <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{headers.length}</div>
                                            <div className="text-xs text-zinc-500">欄位數</div>
                                        </div>
                                        <div className="bg-white dark:bg-zinc-800 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-black text-blue-600">{fileName}</div>
                                            <div className="text-xs text-zinc-500">檔案名稱</div>
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <span className="text-xs text-zinc-500 font-bold">偵測到的欄位名稱：</span>
                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            {headers.map((h, i) => (
                                                <span key={i} className="text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 text-zinc-700 dark:text-zinc-300">{h}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ---- STEP 2: Column Mapping ---- */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100">欄位對照表</h3>
                                <div className="flex gap-3 text-xs">
                                    <span className="text-blue-600 font-bold bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">projects: {projectMappedCount}</span>
                                    <span className="text-purple-600 font-bold bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded">project_steps: {stepMappedCount}</span>
                                    <span className="text-zinc-500 font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">未使用: {ignoredCount}</span>
                                </div>
                            </div>

                            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-zinc-50 dark:bg-zinc-800/80">
                                        <tr>
                                            <th className="text-left px-4 py-2.5 font-bold text-zinc-600 dark:text-zinc-300 w-[30%]">來源欄位</th>
                                            <th className="text-left px-4 py-2.5 font-bold text-zinc-600 dark:text-zinc-300 w-[35%]">對應至系統欄位</th>
                                            <th className="text-left px-4 py-2.5 font-bold text-zinc-600 dark:text-zinc-300">範例值</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {mappings.map((m, ci) => {
                                            const targetValue = m.target.table === "ignore"
                                                ? "ignore"
                                                : m.target.table === "projects"
                                                    ? `projects:${(m.target as any).field}`
                                                    : `step_${(m.target as any).dateType}:${(m.target as any).stepName}`;

                                            const bgColor = m.target.table === "projects" ? "bg-blue-50/40 dark:bg-blue-900/5"
                                                : m.target.table === "project_steps" ? "bg-purple-50/40 dark:bg-purple-900/5"
                                                    : "";

                                            return (
                                                <tr key={ci} className={bgColor}>
                                                    <td className="px-4 py-2.5 font-medium text-zinc-800 dark:text-zinc-200">
                                                        {m.sourceColumn}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <select
                                                            className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                            value={targetValue}
                                                            onChange={(e) => handleMappingChange(ci, e.target.value)}
                                                        >
                                                            <optgroup label="projects 主資料">
                                                                {SYSTEM_FIELDS.filter(f => f.table === "projects").map(f => (
                                                                    <option key={f.value} value={f.value}>{f.label}</option>
                                                                ))}
                                                            </optgroup>
                                                            <optgroup label="project_steps 流程日期">
                                                                {/* If auto-detected as step, show that option */}
                                                                {m.target.table === "project_steps" && (
                                                                    <option value={targetValue}>
                                                                        {(m.target as any).stepName} ({(m.target as any).dateType === "planned" ? "預計日" : "實際日"})
                                                                    </option>
                                                                )}
                                                            </optgroup>
                                                            <optgroup label="其他">
                                                                <option value="ignore">（不匯入）</option>
                                                            </optgroup>
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">
                                                        {m.sampleValues.slice(0, 3).join(" / ") || "—"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ---- STEP 3: Preview ---- */}
                    {step === 3 && (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-black text-blue-700 dark:text-blue-400">{projectPreviews.length}</div>
                                    <div className="text-xs text-blue-600 dark:text-blue-300 font-bold">專案筆數</div>
                                </div>
                                <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/50 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-black text-purple-700 dark:text-purple-400">{stepPreviews.length}</div>
                                    <div className="text-xs text-purple-600 dark:text-purple-300 font-bold">流程日期筆數</div>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-black text-amber-700 dark:text-amber-400">{warningRows.length}</div>
                                    <div className="text-xs text-amber-600 dark:text-amber-300 font-bold">警告筆數</div>
                                </div>
                                <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-center">
                                    <div className="text-2xl font-black text-zinc-700 dark:text-zinc-300">{unmappedColumns.length}</div>
                                    <div className="text-xs text-zinc-500 font-bold">未使用欄位</div>
                                </div>
                            </div>

                            {/* Duplicate Warning */}
                            {duplicateRows.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-sm mb-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                                        可能重複的資料 ({duplicateRows.length} 筆)
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {duplicateRows.map(r => (
                                            <span key={r.rowIndex} className="text-xs bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">第{r.rowIndex}列: {r.name}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Unmapped Columns */}
                            {unmappedColumns.length > 0 && (
                                <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300 font-bold text-sm mb-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        未使用欄位（來源檔有，但目前不匯入）
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {unmappedColumns.map(c => (
                                            <span key={c} className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded">{c}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Projects Preview Table */}
                            <div>
                                <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    將寫入 projects 的預覽資料
                                </h3>
                                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-zinc-50 dark:bg-zinc-800/80">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-bold text-zinc-500">列</th>
                                                <th className="px-3 py-2 text-left font-bold text-zinc-500">案場名稱</th>
                                                <th className="px-3 py-2 text-left font-bold text-zinc-500">kWp</th>
                                                <th className="px-3 py-2 text-left font-bold text-zinc-500">工程</th>
                                                <th className="px-3 py-2 text-left font-bold text-zinc-500">PM</th>
                                                <th className="px-3 py-2 text-left font-bold text-zinc-500">業務</th>
                                                <th className="px-3 py-2 text-left font-bold text-zinc-500">廠商</th>
                                                <th className="px-3 py-2 text-left font-bold text-zinc-500">掛表</th>
                                                <th className="px-3 py-2 text-left font-bold text-zinc-500">警告</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {projectPreviews.slice(0, 50).map(p => (
                                                <tr key={p.rowIndex} className={p.warnings.length > 0 ? "bg-amber-50/50 dark:bg-amber-900/5" : ""}>
                                                    <td className="px-3 py-2 text-zinc-400">{p.rowIndex}</td>
                                                    <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">{p.name || <span className="text-red-500">缺</span>}</td>
                                                    <td className="px-3 py-2 font-mono text-zinc-600 dark:text-zinc-400">{p.kwp ?? <span className="text-red-500">缺</span>}</td>
                                                    <td className="px-3 py-2">
                                                        {p.engineer ? (
                                                            <span className={p.engineerId ? "text-emerald-600" : "text-red-600 font-bold"}>
                                                                {p.engineer} {!p.engineerId && "⚠"}
                                                            </span>
                                                        ) : <span className="text-zinc-300">—</span>}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {p.pm ? (
                                                            <span className={p.pmId ? "text-emerald-600" : "text-red-600 font-bold"}>
                                                                {p.pm} {!p.pmId && "⚠"}
                                                            </span>
                                                        ) : <span className="text-zinc-300">—</span>}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {p.sales ? (
                                                            <span className={p.salesId ? "text-emerald-600" : "text-red-600 font-bold"}>
                                                                {p.sales} {!p.salesId && "⚠"}
                                                            </span>
                                                        ) : <span className="text-zinc-300">—</span>}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {p.structureVendor ? (
                                                            <span className={p.structureVendorId ? "text-emerald-600" : "text-red-600 font-bold"}>
                                                                {p.structureVendor} {!p.structureVendorId && "⚠"}
                                                            </span>
                                                        ) : <span className="text-zinc-300">—</span>}
                                                    </td>
                                                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{p.projectedMeterDate || "—"}</td>
                                                    <td className="px-3 py-2">
                                                        {p.warnings.length > 0 ? (
                                                            <div className="flex flex-col gap-0.5">
                                                                {p.warnings.map((w, i) => (
                                                                    <span key={i} className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">{w}</span>
                                                                ))}
                                                            </div>
                                                        ) : <span className="text-emerald-500">✓</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {projectPreviews.length > 50 && (
                                        <div className="text-center text-xs text-zinc-400 py-2 bg-zinc-50 dark:bg-zinc-800/50">
                                            僅顯示前 50 筆，共 {projectPreviews.length} 筆
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Steps Preview Table */}
                            {stepPreviews.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-bold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                                        將寫入 project_steps 的預覽資料
                                    </h3>
                                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-zinc-50 dark:bg-zinc-800/80">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-bold text-zinc-500">列</th>
                                                    <th className="px-3 py-2 text-left font-bold text-zinc-500">專案名稱</th>
                                                    <th className="px-3 py-2 text-left font-bold text-zinc-500">步驟名稱</th>
                                                    <th className="px-3 py-2 text-left font-bold text-zinc-500">預計日</th>
                                                    <th className="px-3 py-2 text-left font-bold text-zinc-500">實際日</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                                {stepPreviews.slice(0, 100).map((s, i) => (
                                                    <tr key={i}>
                                                        <td className="px-3 py-2 text-zinc-400">{s.rowIndex}</td>
                                                        <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">{s.projectName}</td>
                                                        <td className="px-3 py-2 text-purple-700 dark:text-purple-400 font-bold">{s.stepName}</td>
                                                        <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{s.plannedDate || "—"}</td>
                                                        <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{s.actualDate || "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {stepPreviews.length > 100 && (
                                            <div className="text-center text-xs text-zinc-400 py-2 bg-zinc-50 dark:bg-zinc-800/50">
                                                僅顯示前 100 筆，共 {stepPreviews.length} 筆
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-none flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/80">
                    <div>
                        {step > 1 && (
                            <button onClick={() => setStep((step - 1) as 1 | 2)} className="px-4 py-2 text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                                ← 上一步
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                            關閉
                        </button>
                        {step === 1 && headers.length > 0 && (
                            <button onClick={() => setStep(2)} className="px-5 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                                下一步：欄位對照 →
                            </button>
                        )}
                        {step === 2 && (
                            <button
                                onClick={generatePreview}
                                disabled={isLoadingLookup}
                                className="px-5 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50"
                            >
                                {isLoadingLookup ? "載入中..." : "下一步：預覽結果 →"}
                            </button>
                        )}
                        {step === 3 && (
                            <span className="text-xs text-zinc-400 font-medium italic">
                                目前為預覽模式，尚未寫入資料庫
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
