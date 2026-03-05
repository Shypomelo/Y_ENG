"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ProjectFlowPlan, createProjectFlowPlan, DateCorrectionLog } from "../../lib/mock/project_flow_plan";
import { flowTemplate, FlowNode } from "../../lib/mock/flow_template";

import { useProjects } from "../providers/projects-store";


// --- Procurement Options ---
const PROCURE_OPTIONS = ["步道鋼索", "DC段", "AC接地", "AC管槽", "AC線段"] as const;
const PROCURE_STATUS_CYCLE = ["待請購", "已請購", "已到貨", "缺料"] as const;
type ProcureStatus = typeof PROCURE_STATUS_CYCLE[number];

const PROCURE_STATUS_STYLE: Record<ProcureStatus, string> = {
    "待請購": "bg-zinc-100 text-zinc-700 ring-zinc-400/30 dark:bg-zinc-700 dark:text-zinc-300 dark:ring-zinc-600",
    "已請購": "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
    "已到貨": "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
    "缺料": "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20",
};

// --- Components ---
const ProcureItemsBlock = ({ selectedProject, projects, setProjects }: { selectedProject: ProjectFlowPlan, projects: ProjectFlowPlan[], setProjects: React.Dispatch<React.SetStateAction<ProjectFlowPlan[]>> }) => {
    const [showAll, setShowAll] = useState(false);
    const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
    const [openSelectors, setOpenSelectors] = useState<Record<string, boolean>>({});

    const groups = selectedProject.procureGroups || [];

    const updateProject = (patch: Partial<ProjectFlowPlan>) => {
        setProjects(projects.map(p => p.project_id === selectedProject.project_id ? { ...p, ...patch } : p));
    };

    const updateGroup = (id: string, patch: Record<string, unknown>) => {
        const updated = groups.map(g => g.id === id ? { ...g, ...patch } : g);
        updateProject({ procureGroups: updated });
    };

    const handleAdd = () => {
        const newGroup = { id: `PG-${Date.now()}`, items: [] as string[], status: "待請購" as ProcureStatus };
        updateProject({ procureGroups: [...groups, newGroup] });
        setOpenSelectors(prev => ({ ...prev, [newGroup.id]: true }));
    };

    const handleRemove = (id: string) => {
        updateProject({ procureGroups: groups.filter(g => g.id !== id) });
    };

    const handleCycleStatus = (id: string) => {
        const group = groups.find(g => g.id === id);
        if (!group) return;
        const idx = PROCURE_STATUS_CYCLE.indexOf(group.status);
        const next = PROCURE_STATUS_CYCLE[(idx + 1) % PROCURE_STATUS_CYCLE.length];
        updateGroup(id, { status: next });
    };

    const handleToggleItem = (groupId: string, item: string) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        const items = group.items.includes(item)
            ? group.items.filter(i => i !== item)
            : [...group.items, item];
        updateGroup(groupId, { items });
    };

    const getDateMode = (group: NonNullable<ProjectFlowPlan["procureGroups"]>[0]): "eta" | "actual" => {
        if (group.status === "已到貨") return "actual";
        if (group.status === "缺料") return group.date_mode || "eta";
        return "eta"; // 待請購, 已請購
    };

    const displayed = showAll ? groups : groups.filter(g => g.status !== "已到貨");

    return (
        <div>
            <div className="flex items-center justify-between mb-4 border-b border-zinc-100 dark:border-zinc-700/50 pb-3">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">叫料明細</h3>
                    <button onClick={handleAdd} className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        新增
                    </button>
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
                    <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-600 form-checkbox h-4 w-4" />
                    顯示全部（含已到貨）
                </label>
            </div>

            {displayed.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm bg-zinc-50 dark:bg-zinc-800/30 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
                    {groups.length === 0 ? "目前沒有叫料明細，點擊上方按鈕新增。" : "所有項目已到貨（勾選「顯示全部」可查看）。"}
                </div>
            ) : (
                <div className="space-y-2">
                    {displayed.map(group => {
                        const dateMode = getDateMode(group);
                        const noteOpen = openNotes[group.id] || false;
                        const selectorOpen = openSelectors[group.id] || false;

                        return (
                            <div key={group.id} className={`rounded-lg border p-3 relative group transition-colors ${group.status === "已到貨" ? "bg-zinc-50/50 border-zinc-200 dark:bg-zinc-800/20 dark:border-zinc-800" : group.status === "缺料" ? "bg-red-50/30 border-red-200 dark:bg-red-900/10 dark:border-red-800/40" : "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700"}`}>
                                {/* Delete button */}
                                <button onClick={() => handleRemove(group.id)} className="absolute top-2 right-2 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5" title="刪除">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>

                                {/* Main row */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Items chips + selector toggle */}
                                    <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                                        {group.items.length === 0 && (
                                            <span className="text-xs text-zinc-400 italic">未選擇項目</span>
                                        )}
                                        {group.items.map(item => (
                                            <span key={item} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                                {item}
                                                <button onClick={() => handleToggleItem(group.id, item)} className="text-zinc-400 hover:text-red-500 -mr-0.5">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </span>
                                        ))}
                                        <button onClick={() => setOpenSelectors(prev => ({ ...prev, [group.id]: !prev[group.id] }))} className="inline-flex items-center rounded-full border border-dashed border-zinc-300 dark:border-zinc-600 px-2 py-0.5 text-xs text-zinc-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                                            ＋
                                        </button>
                                    </div>

                                    {/* Status cycle button */}
                                    <button onClick={() => handleCycleStatus(group.id)} className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset cursor-pointer select-none transition-colors shrink-0 ${PROCURE_STATUS_STYLE[group.status]}`}>
                                        {group.status}
                                    </button>

                                    {/* Date */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {group.status === "缺料" && (
                                            <button onClick={() => { const next = dateMode === "eta" ? "actual" : "eta"; updateGroup(group.id, { date_mode: next }); }} className="text-[10px] rounded px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors whitespace-nowrap">
                                                {dateMode === "eta" ? "ETA" : "實際"}
                                            </button>
                                        )}
                                        <span className="text-[10px] text-zinc-400 whitespace-nowrap">{dateMode === "eta" ? "預計到貨" : "實際到貨"}</span>
                                        <input
                                            type="date"
                                            value={(dateMode === "eta" ? group.eta_date : group.actual_date) || ""}
                                            onChange={e => updateGroup(group.id, dateMode === "eta" ? { eta_date: e.target.value } : { actual_date: e.target.value })}
                                            className={`rounded-md border px-2 py-1 text-xs w-[130px] focus:outline-none focus:ring-1 ${dateMode === "actual" ? "border-emerald-300 bg-emerald-50 text-emerald-900 focus:ring-emerald-500 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-100" : "border-zinc-300 bg-white text-zinc-900 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"}`}
                                        />
                                    </div>

                                    {/* Note toggle */}
                                    <button onClick={() => setOpenNotes(prev => ({ ...prev, [group.id]: !prev[group.id] }))} className={`text-xs px-2 py-1 rounded transition-colors shrink-0 ${noteOpen ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600"}`}>
                                        備註{group.note ? " ●" : ""}
                                    </button>
                                </div>

                                {/* Item selector dropdown */}
                                {selectorOpen && (
                                    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                        {PROCURE_OPTIONS.map(opt => {
                                            const selected = group.items.includes(opt);
                                            return (
                                                <button key={opt} onClick={() => handleToggleItem(group.id, opt)} className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${selected ? "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700" : "bg-white text-zinc-600 border-zinc-300 hover:border-blue-300 hover:text-blue-600 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600 dark:hover:border-blue-600"}`}>
                                                    {selected ? "✓ " : ""}{opt}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Note textarea */}
                                {noteOpen && (
                                    <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                        <textarea
                                            value={group.note || ""}
                                            onChange={e => updateGroup(group.id, { note: e.target.value })}
                                            placeholder="輸入備註..."
                                            rows={2}
                                            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 resize-y"
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// Helper for date diff
function getDaysDiff(start: string, end: string) {
    const s = new Date(start);
    const e = new Date(end);
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);
    return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
}

export default function ProjectDetailModal({
    isOpen,
    onClose,
    selectedProjectId,
    focusStepId,
    defaultTab = "流程",
}: {
    isOpen: boolean;
    onClose: () => void;
    selectedProjectId: string | null;
    focusStepId: string | null;
    defaultTab?: "流程" | "工程";
}) {
    const { projects, setProjects } = useProjects();

    // Drag and Drop state
    const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
    // Add Flow Step state
    const [isAddingStep, setIsAddingStep] = useState(false);
    const [stepForm, setStepForm] = useState({ nodeId: "", name: "", lane: "專案" as any, baseline: "" });

    // Delay Reason Modal state
    const [delayModalConfig, setDelayModalConfig] = useState<{ projectId: string, stepId: string, delay_override: boolean, delay_reason: string } | null>(null);

    // Complete Step Modal state
    const [completeModalConfig, setCompleteModalConfig] = useState<{ projectId: string, stepId: string, actualEnd: string, delayDays: number, delayReason: string, baselineEnd: string } | null>(null);

    // Edit Date Modal state (DateCorrectionLog)
    const [editDateModalConfig, setEditDateModalConfig] = useState<{ projectId: string, stepId: string, beforeEnd: string, afterEnd: string, note: string } | null>(null);

    // Show Corrections Modal state
    const [historyModalConfig, setHistoryModalConfig] = useState<{ stepName: string, corrections: DateCorrectionLog[] } | null>(null);

    // Close Project Modal state
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [closeDate, setCloseDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [closeMemo, setCloseMemo] = useState("");
    const [closeDelayReasons, setCloseDelayReasons] = useState<Record<string, string>>({});
    const [closeError, setCloseError] = useState("");
    const [statusTexts, setStatusTexts] = useState<Record<string, { power: string, structure: string, admin: string, engineering: string }>>({});
    const [isEditingStatus, setIsEditingStatus] = useState(false);

    // --- Second Level Detail Modal Tab State ---
    const [detailActiveTab, setDetailActiveTab] = useState<"流程" | "工程">("流程");



    const selectedProject = useMemo(() => projects.find(p => p.project_id === selectedProjectId) || null, [projects, selectedProjectId]);





    // Synchronization for horizontal scrolling
    const stepsScrollerRef = useRef<HTMLDivElement>(null);
    const [scrollProgress, setScrollProgress] = useState(0);

    const handleScroll = () => {
        if (stepsScrollerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = stepsScrollerRef.current;
            const maxScroll = scrollWidth - clientWidth;
            if (maxScroll > 0) {
                setScrollProgress((scrollLeft / maxScroll) * 100);
            } else {
                setScrollProgress(0);
            }
        }
    };

    const handleScrollSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        setScrollProgress(value);
        if (stepsScrollerRef.current) {
            const { scrollWidth, clientWidth } = stepsScrollerRef.current;
            const maxScroll = scrollWidth - clientWidth;
            stepsScrollerRef.current.scrollLeft = (value / 100) * maxScroll;
        }
    };

    const scrollByAmount = (amount: number) => {
        if (stepsScrollerRef.current) {
            stepsScrollerRef.current.scrollBy({ left: amount, behavior: "smooth" });
        }
    };

    // --- Helpers ---
    const METER_STEP_ID = "P-007";

    const isMeteredProject = (project: ProjectFlowPlan) => {
        const step = project.steps.find(s => s.id === METER_STEP_ID);
        if (!step) return false;
        if (step.status !== "完成") return false;
        if (!step.actual_end || step.actual_end.trim() === "") return false;
        return true;
    };

    const getCurrentStepIndex = (project: ProjectFlowPlan) => {
        const idx = project.steps.findIndex(s => s.status === "進行中");
        return idx !== -1 ? idx : (project.steps.length > 0 && project.steps[project.steps.length - 1].status === "完成" ? project.steps.length - 1 : 0);
    };

    const isWarningProject = (project: ProjectFlowPlan) => {
        const todayStr = new Date().toISOString().split("T")[0];
        const currentIndex = getCurrentStepIndex(project);
        const currentStep = project.steps[currentIndex];

        // 條件一：正在進行中的步驟，今天 > current_planned_end
        if (currentStep && currentStep.status !== "完成" && getDaysDiff(todayStr, currentStep.current_planned_end) < 0) {
            return true;
        }

        // 條件二：有任何曾經逾期 (delay_days > 0) 且未填寫延遲原因的步驟
        const hasUnexplainedDelay = project.steps.some(s =>
            s.delay_days && s.delay_days > 0 && !s.delay_reason
        );
        if (hasUnexplainedDelay) return true;

        return false;
    };

    const recalculateProjectDates = (project: ProjectFlowPlan): ProjectFlowPlan => {
        let newSteps = [...project.steps];
        for (let i = 0; i < newSteps.length; i++) {
            const step = newSteps[i];
            const templateNode = flowTemplate.find(t => t.id === step.id);
            const dependsOnIds = templateNode?.depends_on || [];

            let maxDelayShift = 0;
            if (dependsOnIds.length > 0) {
                const dependencies = newSteps.filter(s => dependsOnIds.includes(s.id));
                dependencies.forEach(dep => {
                    const depDate = dep.status === "完成" && dep.actual_end ? dep.actual_end : dep.current_planned_end;
                    const shift = getDaysDiff(dep.baseline_planned_end, depDate);
                    if (shift > maxDelayShift) maxDelayShift = shift;
                });
            } else if (i > 0) {
                // Sequential fallback to previous step if no explicit dependencies
                const prevStep = newSteps[i - 1];
                const prevDate = prevStep.status === "完成" && prevStep.actual_end ? prevStep.actual_end : prevStep.current_planned_end;
                const shift = getDaysDiff(prevStep.baseline_planned_end, prevDate);
                if (shift > maxDelayShift) maxDelayShift = shift;
            }

            const baselineDate = addDays(project.start_date, step.offset_days);

            newSteps[i] = {
                ...step,
                baseline_planned_end: baselineDate,
                current_planned_end: addDays(baselineDate, maxDelayShift)
            };
        }
        return { ...project, steps: newSteps };
    };



    const handleUpdateStep = (projectId: string, stepId: string, field: "offset_days" | "planned_date", value: string | number) => {
        setProjects(prev => prev.map(p => {
            if (p.project_id !== projectId) return p;
            const newSteps = p.steps.map(s => {
                if (s.id !== stepId) return s;
                const newStep = { ...s };
                if (field === "offset_days") {
                    const days = parseInt(value as string, 10) || 0;
                    newStep.offset_days = days;
                }
                // We no longer allow manual adjustment of planned_date directly if we rely on offset_days,
                // but if we do, we adjust offset_days. Let's keep it adjusting offset_days relative to start_date.
                if (field === "planned_date") {
                    const newDate = value as string;
                    if (newDate) {
                        newStep.offset_days = getDaysDiff(p.start_date, newDate);
                    }
                }
                return newStep;
            });
            return recalculateProjectDates({ ...p, steps: newSteps });
        }));
    };

    const handleUpdateStepStatus = (projectId: string, stepId: string, newStatus: "未開始" | "進行中" | "完成" | "卡關") => {
        const todayStr = new Date().toISOString().split("T")[0];

        setProjects(prev => prev.map(p => {
            if (p.project_id !== projectId) return p;
            const newSteps = p.steps.map(s => {
                if (s.id !== stepId) return s;
                const updatedStep = {
                    ...s,
                    status: newStatus,
                    updated_at: new Date().toISOString()
                };

                if (newStatus === "完成") {
                    updatedStep.actual_end = s.actual_end || todayStr;
                    updatedStep.delay_days = Math.max(0, getDaysDiff(s.baseline_planned_end, updatedStep.actual_end));
                } else {
                    updatedStep.actual_end = undefined;
                    updatedStep.delay_days = 0;
                }
                return updatedStep;
            });
            return recalculateProjectDates({ ...p, steps: newSteps });
        }));
    };

    const handleConfirmComplete = () => {
        if (!completeModalConfig) return;
        setProjects(prev => prev.map(p => {
            if (p.project_id !== completeModalConfig.projectId) return p;
            const newSteps = p.steps.map(s => {
                if (s.id !== completeModalConfig.stepId) return s;

                const delayDays = Math.max(0, getDaysDiff(s.baseline_planned_end, completeModalConfig.actualEnd));

                return {
                    ...s,
                    status: "完成" as const,
                    actual_end: completeModalConfig.actualEnd,
                    delay_days: delayDays,
                    delay_reason: completeModalConfig.delayReason,
                    updated_at: new Date().toISOString()
                };
            });
            return recalculateProjectDates({ ...p, steps: newSteps });
        }));
        setCompleteModalConfig(null);
    };

    const handleSaveDateCorrection = () => {
        if (!editDateModalConfig) return;
        setProjects(prev => prev.map(p => {
            if (p.project_id !== editDateModalConfig.projectId) return p;

            const newSteps = p.steps.map(s => {
                if (s.id !== editDateModalConfig.stepId) return s;

                const delayDays = Math.max(0, getDaysDiff(s.baseline_planned_end, editDateModalConfig.afterEnd));

                const correctionObj: DateCorrectionLog = {
                    id: crypto.randomUUID(),
                    step_id: s.id,
                    field: "actual_end",
                    before: editDateModalConfig.beforeEnd,
                    after: editDateModalConfig.afterEnd,
                    corrected_at: new Date().toISOString(),
                    corrected_by: "使用者", // Mock user
                    note: editDateModalConfig.note
                };

                return {
                    ...s,
                    actual_end: editDateModalConfig.afterEnd,
                    delay_days: delayDays,
                    corrections: [...(s.corrections || []), correctionObj],
                    updated_at: new Date().toISOString()
                };
            });
            return recalculateProjectDates({ ...p, steps: newSteps });
        }));
        setEditDateModalConfig(null);
    };

    const handleSaveDelayReason = () => {
        if (!delayModalConfig) return;
        setProjects(prev => prev.map(p => {
            if (p.project_id !== delayModalConfig.projectId) return p;
            const newSteps = p.steps.map(s => {
                if (s.id !== delayModalConfig.stepId) return s;
                return { ...s, delay_override: delayModalConfig.delay_override, delay_reason: delayModalConfig.delay_reason, updated_at: new Date().toISOString() };
            });
            return { ...p, steps: newSteps };
        }));
        setDelayModalConfig(null);
    };

    // --- Available nodes to add (from flowTemplate, excluding already-added step IDs) ---
    const availableNodesToAdd = useMemo(() => {
        if (!selectedProject) return [];
        const existingIds = new Set(selectedProject.steps.map(s => s.id));
        return flowTemplate.filter(node => !existingIds.has(node.id));
    }, [selectedProject]);

    // --- Add Step ---
    const handleAddStepWithBaseline = (projectId: string) => {
        const { name, lane, baseline, nodeId } = stepForm;
        if (!name || !baseline) return;

        setProjects(prev => prev.map(p => {
            if (p.project_id !== projectId) return p;

            // If it's a library node, we might want to keep its original ID prefix or properties
            // but for simplicity and to avoid ID collisions if same node added twice, 
            // we use the same ID generation or prefix
            const stepId = nodeId || `CUSTOM-${Date.now()}`;

            const newStep = {
                id: stepId,
                name,
                lane,
                offset_days: getDaysDiff(p.start_date, baseline),
                baseline_planned_end: baseline,
                current_planned_end: baseline,
                status: "未開始" as const,
                updated_at: new Date().toISOString(),
                // If it was from library, mark as core based on template if available
                is_core: flowTemplate.find(n => n.id === nodeId)?.is_core ?? false
            };
            return recalculateProjectDates({ ...p, steps: [...p.steps, newStep] });
        }));
        setIsAddingStep(false);
        setStepForm({ nodeId: "", name: "", lane: "專案", baseline: "" });
    };

    // --- Drag and Drop handlers ---
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedStepIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, _index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number, projectId: string) => {
        e.preventDefault();
        if (draggedStepIndex === null || draggedStepIndex === dropIndex) {
            setDraggedStepIndex(null);
            return;
        }
        setProjects(prev => prev.map(p => {
            if (p.project_id !== projectId) return p;
            const steps = [...p.steps];
            const [moved] = steps.splice(draggedStepIndex, 1);
            steps.splice(dropIndex, 0, moved);
            return recalculateProjectDates({ ...p, steps });
        }));
        setDraggedStepIndex(null);
    };

    // --- Remove Step ---
    const handleRemoveStep = (projectId: string, stepId: string) => {
        setProjects(prev => prev.map(p => {
            if (p.project_id !== projectId) return p;
            return recalculateProjectDates({ ...p, steps: p.steps.filter(s => s.id !== stepId) });
        }));
    };

    if (!isOpen || !selectedProject) return null;

    return (
        <>
            {/* 第二層彈窗 (20 步詳細資訊與編輯) */}
            {isOpen && selectedProject && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 py-8 sm:p-6 overflow-y-auto">
                    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm transition-opacity" onClick={() => onClose()} />

                    <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-800">
                        <div className="flex-none items-center flex justify-between border-b border-zinc-100 bg-zinc-50/50 px-6 pt-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">專案流程計畫 ({selectedProject.project_name})</h2>
                            <button
                                onClick={() => onClose()}
                                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* 第二層 Tab Navbar */}
                        <div className="flex-none bg-zinc-50/50 dark:bg-zinc-900/50 px-6 border-b border-zinc-200 dark:border-zinc-800">
                            <div className="flex gap-6 -mb-px">
                                <button
                                    onClick={() => setDetailActiveTab("流程")}
                                    className={`py-3 text-sm font-medium border-b-2 transition-colors ${detailActiveTab === "流程" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:border-zinc-700"}`}
                                >
                                    流程
                                </button>
                                <button
                                    onClick={() => setDetailActiveTab("工程")}
                                    className={`py-3 text-sm font-medium border-b-2 transition-colors ${detailActiveTab === "工程" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:border-zinc-700"}`}
                                >
                                    工程
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-50/30 dark:bg-zinc-900/30">
                            {detailActiveTab === "流程" && (
                                <>
                                    <div className="mb-4 text-sm text-zinc-500">
                                        開案日 (Start Date): <span className="font-bold text-zinc-800 dark:text-zinc-200">{selectedProject.start_date}</span>
                                        <br />修改「Offset 天數」將自動推算預計日期；修改「預計日期」將自動反推天數。可以拖曳列來排序。
                                    </div>

                                    <div className="mb-6 flex flex-col gap-4 bg-zinc-100/50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">流程項目管理</span>
                                            <button
                                                onClick={() => setIsAddingStep(!isAddingStep)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition-colors shadow-sm"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                                {isAddingStep ? "取消新增" : "新增流程項目"}
                                            </button>
                                        </div>

                                        {isAddingStep && (
                                            <div className="mt-2 pt-4 border-t border-zinc-200 dark:border-zinc-700 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end animate-in fade-in slide-in-from-top-2 duration-200">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-zinc-500 mb-1 leading-none">節點選擇 (流程庫)</label>
                                                    <select
                                                        value={stepForm.nodeId}
                                                        onChange={e => {
                                                            const nodeId = e.target.value;
                                                            const node = flowTemplate.find(n => n.id === nodeId);
                                                            setStepForm(prev => ({
                                                                ...prev,
                                                                nodeId,
                                                                name: node ? node.name : prev.name,
                                                                lane: node ? node.lane : prev.lane
                                                            }));
                                                        }}
                                                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 focus:ring-1 focus:ring-blue-500 outline-none"
                                                    >
                                                        <option value="">-- 自定義名稱 --</option>
                                                        {["工程", "專案", "業務", "結構", "行政"].map(dept => (
                                                            <optgroup key={dept} label={dept}>
                                                                {flowTemplate.filter(n => n.lane === dept).map(n => (
                                                                    <option key={n.id} value={n.id}>{n.name}</option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-zinc-500 mb-1 leading-none">節點名稱 (確認)</label>
                                                    <input
                                                        type="text"
                                                        value={stepForm.name}
                                                        onChange={e => setStepForm(prev => ({ ...prev, name: e.target.value }))}
                                                        placeholder="自定義名稱..."
                                                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 focus:ring-1 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-zinc-500 mb-1 leading-none">原定日期 (Baseline)</label>
                                                    <input
                                                        type="date"
                                                        value={stepForm.baseline}
                                                        onChange={e => setStepForm(prev => ({ ...prev, baseline: e.target.value }))}
                                                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 focus:ring-1 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleAddStepWithBaseline(selectedProject.project_id)}
                                                    disabled={!stepForm.name || !stepForm.baseline}
                                                    className="w-full rounded bg-zinc-900 px-4 py-1.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                                                >
                                                    確定新增
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* 新版流程列表：直式兩行版型 */}
                                    <div className="space-y-3">
                                        {selectedProject.steps.map((step, idx) => (
                                            <div
                                                key={step.id}
                                                id={`step-row-${step.id}`}
                                                className={`group relative bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm hover:border-zinc-400 dark:hover:border-zinc-600 transition-all ${draggedStepIndex === idx ? 'opacity-50 ring-2 ring-blue-500' : ''}`}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, idx)}
                                                onDragOver={(e) => handleDragOver(e, idx)}
                                                onDrop={(e) => handleDrop(e, idx, selectedProject.project_id)}
                                                onDragEnd={() => setDraggedStepIndex(null)}
                                            >
                                                {/* Header Line */}
                                                <div className="flex items-start justify-between gap-4 mb-3">
                                                    <div className="flex items-start gap-3 min-w-0">
                                                        <div className="mt-1 shrink-0 text-[10px] font-mono text-zinc-400 cursor-move bg-zinc-50 dark:bg-zinc-800 rounded px-1.5 py-0.5 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                                                            {String(idx + 1).padStart(2, '0')}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">{step.name}</h4>
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 rounded">
                                                                    {step.lane}
                                                                </span>
                                                                <select
                                                                    value={step.status}
                                                                    onChange={(e) => handleUpdateStepStatus(selectedProject.project_id, step.id, e.target.value as any)}
                                                                    className={`rounded-md text-[10px] font-bold px-2 py-0.5 focus:outline-none ring-1 ring-inset ${step.status === '完成' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20' :
                                                                        step.status === '進行中' ? 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20' :
                                                                            step.status === '卡關' ? 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/20' :
                                                                                'bg-zinc-50 text-zinc-600 ring-zinc-500/10 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700'
                                                                        }`}
                                                                >
                                                                    <option value="未開始">未開始</option>
                                                                    <option value="進行中">進行中</option>
                                                                    <option value="卡關">卡關</option>
                                                                    <option value="完成">完成</option>
                                                                </select>
                                                            </div>

                                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                                {step.status !== "完成" && getDaysDiff(new Date().toISOString().split("T")[0], step.current_planned_end) < 0 && (
                                                                    <span className="inline-flex items-center rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-inset ring-red-600/10 dark:bg-red-900/20 dark:text-red-400">
                                                                        逾期 {Math.abs(getDaysDiff(new Date().toISOString().split("T")[0], step.current_planned_end))} 天
                                                                    </span>
                                                                )}
                                                                {step.status === "完成" && step.delay_days && step.delay_days > 0 && (
                                                                    <button onClick={() => setDelayModalConfig({ projectId: selectedProject.project_id, stepId: step.id, delay_override: step.delay_override || true, delay_reason: step.delay_reason || "" })} className="text-[10px] font-medium text-yellow-800 bg-yellow-50 px-1.5 py-0.5 rounded ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/20 dark:text-yellow-400">
                                                                        曾逾期 {step.delay_days} 天
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            onClick={() => setDelayModalConfig({ projectId: selectedProject.project_id, stepId: step.id, delay_override: step.delay_override || false, delay_reason: step.delay_reason || "" })}
                                                            className="p-1.5 text-zinc-400 hover:text-amber-600 transition-colors"
                                                            title="原因/紀錄"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleRemoveStep(selectedProject.project_id, step.id)}
                                                            className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                                                            title="移除"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Date Line */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-1">
                                                    <div>
                                                        <div className="text-[10px] font-bold text-zinc-400 mb-0.5">OFFSET</div>
                                                        <input
                                                            type="number"
                                                            value={step.offset_days}
                                                            onChange={(e) => handleUpdateStep(selectedProject.project_id, step.id, "offset_days", e.target.value)}
                                                            className="w-16 rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-bold text-zinc-400 mb-0.5 uppercase tracking-wider">Baseline (原定)</div>
                                                        <div className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">{step.baseline_planned_end}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-bold text-zinc-400 mb-0.5 uppercase tracking-wider">Current (預計)</div>
                                                        <div className="text-xs text-amber-600 dark:text-amber-500 font-bold">{step.current_planned_end}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-bold text-zinc-400 mb-0.5 uppercase tracking-wider">Actual (實際)</div>
                                                        {step.actual_end ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-xs text-emerald-600 dark:text-emerald-500 font-bold">{step.actual_end}</span>
                                                                <button
                                                                    onClick={() => setEditDateModalConfig({
                                                                        projectId: selectedProject.project_id,
                                                                        stepId: step.id,
                                                                        beforeEnd: step.actual_end || "",
                                                                        afterEnd: step.actual_end || "",
                                                                        note: ""
                                                                    })}
                                                                    className="text-[9px] text-blue-500 hover:underline mt-0.5 text-left"
                                                                >
                                                                    修改日期
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-zinc-300 dark:text-zinc-700 font-medium italic">- 未核定 -</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {detailActiveTab === "工程" && (
                                <div className="space-y-8">
                                    {/* 區塊一：進場項目選配清單 */}
                                    <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700/50 shadow-sm">
                                        <div className="flex items-center justify-between mb-4 border-b border-zinc-100 dark:border-zinc-700/50 pb-3">
                                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">進場項目選配清單</h3>
                                            <div className="flex items-center gap-3">
                                                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">進場日期：</label>
                                                <input
                                                    type="date"
                                                    value={selectedProject.enginePlan?.entry_date || ""}
                                                    onChange={(e) => {
                                                        const updated = {
                                                            ...selectedProject,
                                                            enginePlan: {
                                                                ...selectedProject.enginePlan,
                                                                items: selectedProject.enginePlan?.items || [],
                                                                entry_date: e.target.value
                                                            }
                                                        };
                                                        setProjects(projects.map(p => p.project_id === selectedProject.project_id ? updated : p));
                                                    }}
                                                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                                />
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm max-w-3xl">
                                                <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400">
                                                    <tr>
                                                        <th className="px-4 py-2 font-semibold">項目</th>
                                                        <th className="px-4 py-2 font-semibold text-center w-24">進場</th>
                                                        <th className="px-4 py-2 font-semibold text-center w-24">完成</th>
                                                        <th className="px-4 py-2 font-semibold text-center w-32">狀態</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                                    {["植筋", "預埋螺栓", "新設頂蓋", "支架", "鋼構", "鋪板", "DC線槽", "DC線段", "AC線管槽", "AC線段", "INV", "ACP", "KWH", "受電箱", "監控"].map(key => {
                                                        const item = selectedProject.enginePlan?.items?.find(i => i.key === key) || { key, entered: false, done: false };
                                                        const status = (item.entered && item.done) ? "完成" : (item.entered ? "進行中" : "待進場");

                                                        return (
                                                            <tr key={key} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                                <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{key}</td>
                                                                <td className="px-4 py-2.5 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={item.entered}
                                                                        onChange={(e) => {
                                                                            const checked = e.target.checked;
                                                                            const currentItems = selectedProject.enginePlan?.items || [];
                                                                            const filtered = currentItems.filter(i => i.key !== key);
                                                                            const newItems = [...filtered, { key, entered: checked, done: checked ? item.done : false }];

                                                                            const updated = {
                                                                                ...selectedProject,
                                                                                enginePlan: {
                                                                                    entry_date: selectedProject.enginePlan?.entry_date,
                                                                                    items: newItems
                                                                                }
                                                                            };
                                                                            setProjects(projects.map(p => p.project_id === selectedProject.project_id ? updated : p));
                                                                        }}
                                                                        className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-600 form-checkbox h-4 w-4 bg-white dark:bg-zinc-900"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-2.5 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={item.done}
                                                                        disabled={!item.entered}
                                                                        onChange={(e) => {
                                                                            const checked = e.target.checked;
                                                                            const currentItems = selectedProject.enginePlan?.items || [];
                                                                            const filtered = currentItems.filter(i => i.key !== key);
                                                                            const newItems = [...filtered, { key, entered: item.entered, done: checked }];

                                                                            const updated = {
                                                                                ...selectedProject,
                                                                                enginePlan: {
                                                                                    entry_date: selectedProject.enginePlan?.entry_date,
                                                                                    items: newItems
                                                                                }
                                                                            };
                                                                            setProjects(projects.map(p => p.project_id === selectedProject.project_id ? updated : p));
                                                                        }}
                                                                        className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-600 form-checkbox h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-zinc-900"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-2.5 text-center">
                                                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${status === '完成' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20' :
                                                                        status === '進行中' ? 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20' :
                                                                            'bg-zinc-50 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-500/10 dark:text-zinc-400 dark:ring-zinc-500/20'
                                                                        }`}>
                                                                        {status}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* 區塊二：叫料明細 Placeholder component for now */}
                                    <div className="bg-white dark:bg-zinc-800/50 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700/50 shadow-sm">
                                        <ProcureItemsBlock selectedProject={selectedProject} projects={projects} setProjects={setProjects} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}