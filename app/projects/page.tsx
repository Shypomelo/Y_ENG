"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ProjectFlowPlan, createProjectFlowPlan, DateCorrectionLog } from "../../lib/mock/project_flow_plan";
import { flowTemplate, FlowNode } from "../../lib/mock/flow_template";

import { useProjects } from "../providers/projects-store";
import ProjectDetailModal from "../components/ProjectDetailModal";


export default function ProjectsPage() {
    const { projects, setProjects } = useProjects();
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [activeTab, setActiveTab] = useState<"全部" | "警示及重要案件" | "商用案" | "一般案" | "已掛表" | "已結案">("全部");

    // --- Create Wizard State ---
    const MOCK_USERS = ["未指定", "子佑", "A同事", "B同事", "C同事", "工程主管"];
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState<1 | 2>(1);
    const [newProjectTemp, setNewProjectTemp] = useState<ProjectFlowPlan | null>(null);
    const [wizardDraggedStepIndex, setWizardDraggedStepIndex] = useState<number | null>(null);
    const [wizardSelectedNodeId, setWizardSelectedNodeId] = useState<string>("");

    const selectedProject = useMemo(() => projects.find(p => p.project_id === selectedProjectId) || null, [projects, selectedProjectId]);

    const closeMainModal = () => setSelectedProjectId(null);

    // Read URL params for direct navigation
    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        const pid = params.get("projectId");
        const open = params.get("open");
        const layer = params.get("layer");
        const tab = params.get("tab");
        const stepId = params.get("stepId");

        if (pid && open === "1") {
            setSelectedProjectId(pid);
            if (layer === "2") {
                setShowDetailModal(true);
                if (tab === "flow") {
                    setDetailActiveTab("流程");
                } else if (tab === "engineering") {
                    setDetailActiveTab("工程");
                }

                if (stepId) {
                    setTimeout(() => {
                        const el = document.getElementById(`step-row-${stepId}`);
                        if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                            el.classList.add("!bg-blue-100", "dark:!bg-blue-900/40", "transition-all", "duration-1000");
                            setTimeout(() => {
                                el.classList.remove("!bg-blue-100", "dark:!bg-blue-900/40");
                            }, 2000);
                        }
                    }, 100);
                }
            }
            window.history.replaceState(null, "", window.location.pathname);
        }
    }, [projects]);

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

    // Filter out available nodes to add (not currently in steps)
    const availableNodesToAdd = selectedProject
        ? flowTemplate.filter(node => !selectedProject.steps.some(s => s.id === node.id) && !node.is_archived)
        : [];

    const availableNodesWizard = newProjectTemp
        ? flowTemplate.filter(node => !newProjectTemp.steps.some(s => s.id === node.id) && !node.is_archived)
        : [];

    // --- Wizard Handlers ---
    const handleOpenWizard = () => {
        setIsWizardOpen(true);
        setWizardStep(1);
        setNewProjectTemp({
            project_id: `P${Date.now()}`,
            project_name: "",
            start_date: new Date().toISOString().split("T")[0],
            project_status: "進行中",
            kWp: 100,
            isImportant: false,
            owners: { sales: "未指定", pm: "未指定", engineering: "未指定", structural: "未指定", admin: "未指定" },
            steps: []
        });
    };

    const handleWizardNext = () => {
        if (!newProjectTemp || !newProjectTemp.project_name) return;
        if (newProjectTemp.steps.length === 0) {
            const initialFlow = createProjectFlowPlan(newProjectTemp.project_id, newProjectTemp.project_name, newProjectTemp.start_date, newProjectTemp.kWp, newProjectTemp.owners);
            setNewProjectTemp({ ...newProjectTemp, steps: initialFlow.steps });
        }
        setWizardStep(2);
    };

    const handleWizardComplete = () => {
        if (!newProjectTemp) return;
        setProjects(prev => [newProjectTemp, ...prev]);
        setIsWizardOpen(false);
        setNewProjectTemp(null);
        setActiveTab("全部");
    };

    const handleWizardUpdateStep = (stepId: string, field: "offset_days" | "planned_date", value: string | number) => {
        setNewProjectTemp(prev => {
            if (!prev) return prev;
            const newSteps = prev.steps.map(s => {
                if (s.id !== stepId) return s;
                const newStep = { ...s };
                if (field === "offset_days") newStep.offset_days = parseInt(value as string, 10) || 0;
                if (field === "planned_date") {
                    const newDate = value as string;
                    if (newDate) newStep.offset_days = getDaysDiff(prev.start_date, newDate);
                }
                return newStep;
            });
            return recalculateProjectDates({ ...prev, steps: newSteps });
        });
    };

    const handleWizardDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (wizardDraggedStepIndex === null || wizardDraggedStepIndex === index) return;
        setNewProjectTemp(prev => {
            if (!prev) return prev;
            const newSteps = [...prev.steps];
            const [draggedItem] = newSteps.splice(wizardDraggedStepIndex, 1);
            newSteps.splice(index, 0, draggedItem);
            return recalculateProjectDates({ ...prev, steps: newSteps });
        });
        setWizardDraggedStepIndex(null);
    };

    const handleWizardAddStep = () => {
        if (!wizardSelectedNodeId || !newProjectTemp) return;
        const nodeToAdd = flowTemplate.find(n => n.id === wizardSelectedNodeId);
        if (!nodeToAdd) return;
        setNewProjectTemp(prev => {
            if (!prev) return prev;
            const newSteps = [...prev.steps];
            newSteps.push({
                id: nodeToAdd.id,
                name: nodeToAdd.name,
                lane: nodeToAdd.lane,
                offset_days: nodeToAdd.offset_days,
                baseline_planned_end: addDays(prev.start_date, nodeToAdd.offset_days),
                current_planned_end: addDays(prev.start_date, nodeToAdd.offset_days),
                status: "未開始",
                updated_at: new Date().toISOString()
            });
            return recalculateProjectDates({ ...prev, steps: newSteps });
        });
        setWizardSelectedNodeId("");
    };

    const handleWizardRemoveStep = (stepId: string) => {
        setNewProjectTemp(prev => {
            if (!prev) return prev;
            const newSteps = prev.steps.filter(s => s.id !== stepId);
            return recalculateProjectDates({ ...prev, steps: newSteps });
        });
    };

    return (
        <div className="container mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
            {/* Top Bar... */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    專案狀態
                </h1>
                <div className="flex items-center gap-3">
                    <button onClick={handleOpenWizard} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 whitespace-nowrap transition-colors">
                        ＋建立專案
                    </button>
                </div>
            </div>

            {/* Bookmark Tabs */}
            <div className="flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 mb-6 no-scrollbar">
                {(["全部", "警示及重要案件", "商用案", "一般案", "已掛表", "已結案"] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`whitespace-nowrap py-3 px-5 border-b-2 font-medium text-sm transition-colors ${activeTab === tab
                            ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10 rounded-t-lg"
                            : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:border-zinc-700"
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Project Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((project) => {
                    const currentIndex = getCurrentStepIndex(project);
                    const currentStep = project.steps[currentIndex];
                    const nextStep = project.steps[currentIndex + 1];

                    // 定義工程狀態關鍵節點 ID
                    const ENTRY_STEP_ID = "E-004";
                    const TEST_STEP_ID = "E-006";

                    const entryStep = project.steps.find(s => s.id === ENTRY_STEP_ID);
                    const testStep = project.steps.find(s => s.id === TEST_STEP_ID);
                    const meterStep = project.steps.find(s => s.id === METER_STEP_ID);

                    let engStatus = "未進場";
                    if (testStep && testStep.status === "完成") {
                        engStatus = "已完工";
                    } else if (entryStep && entryStep.status === "完成") {
                        engStatus = "施工中";
                    } else if (entryStep) {
                        const planned = entryStep.current_planned_end || entryStep.baseline_planned_end;
                        const todayStr = new Date().toISOString().split("T")[0];
                        if (planned && todayStr > planned) {
                            engStatus = "未進場(已到期)";
                        }
                    }

                    // 判定專案狀態
                    let projStatus = { label: "正常", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" };
                    if (project.project_status === "已結案") {
                        projStatus = { label: "已結案", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700" };
                    } else {
                        const isWarning = project.steps.some(s => {
                            if (s.status !== "完成") {
                                const planned = s.current_planned_end || s.baseline_planned_end;
                                const todayStr = new Date().toISOString().split("T")[0];
                                return planned && todayStr > planned;
                            } else {
                                return (s.delay_days ?? 0) > 0 && !s.delay_reason;
                            }
                        });
                        if (isWarning) {
                            projStatus = { label: "警示", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800" };
                        } else if (project.isImportant) {
                            projStatus = { label: "重要", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" };
                        }
                    }

                    // 簡單 mock 燈號：如果預計日期 < 今天且還是進行中，亮紅燈，否則綠燈
                    let indicatorColor = "bg-emerald-500";
                    if (currentStep && currentStep.status === "進行中") {
                        const todayStr = new Date().toISOString().split("T")[0];
                        if (getDaysDiff(todayStr, currentStep.current_planned_end) < 0) indicatorColor = "bg-red-500";
                        else if (getDaysDiff(todayStr, currentStep.current_planned_end) <= 3) indicatorColor = "bg-amber-400";
                    } else if (currentStep && currentStep.status === "未開始") {
                        indicatorColor = "bg-zinc-300";
                    } else if (currentStep && currentStep.status === "卡關") {
                        indicatorColor = "bg-orange-500";
                    }

                    return (
                        <div
                            key={project.project_id}
                            onClick={() => setSelectedProjectId(project.project_id)}
                            className="group relative cursor-pointer rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 transition-all hover:-translate-y-1 hover:shadow-md hover:ring-zinc-400 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-600 flex flex-col"
                        >
                            <span className={`absolute left-4 top-4 h-3 w-3 rounded-full ${project.project_status === "已結案" ? "bg-zinc-400" : indicatorColor} ring-2 ring-white dark:ring-zinc-900 transition-colors`} />

                            <div className="absolute right-4 top-3 flex gap-2 items-center">
                                {project.isImportant && (
                                    <span className="text-xs font-bold text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                        重要
                                    </span>
                                )}
                                {project.project_status === "已結案" && (
                                    <span className="text-xs font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                                        已結案
                                    </span>
                                )}
                                <button
                                    onClick={(e) => handleToggleImportant(e, project.project_id)}
                                    className={`p-1 rounded-full transition-colors ${project.isImportant ? 'text-amber-500' : 'text-zinc-300 hover:text-amber-500 dark:text-zinc-600'}`}
                                    title={project.isImportant ? "取消重要標示" : "標示為重要"}
                                >
                                    <svg className="w-5 h-5" fill={project.isImportant ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={project.isImportant ? 0 : 2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    </svg>
                                </button>
                            </div>

                            <div className="mt-5 text-left pl-1 flex-1 flex flex-col">
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {project.project_name}
                                </h3>
                                <div className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-4 flex items-center gap-2">
                                    <span>工程：{project.owners?.engineering || "未指定"}</span>
                                    <span className="text-zinc-300 dark:text-zinc-600">•</span>
                                    <span>{project.kWp} Kwp</span>
                                </div>
                                <div className="space-y-2 mb-4 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-700/50 flex-1">
                                    <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate flex items-center justify-between">
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-200 shrink-0">目前流程</span>
                                        <span className="text-zinc-700 dark:text-zinc-300 ml-2 truncate">{currentStep?.name || "無"}</span>
                                    </div>
                                    <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate flex items-center justify-between">
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-200 shrink-0">下一步流程</span>
                                        <span className="text-zinc-700 dark:text-zinc-300 ml-2 truncate">{nextStep?.name || "無 (已到最後)"}</span>
                                    </div>
                                    <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate flex items-center justify-between">
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-200 shrink-0">專案狀態</span>
                                        <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded border ${projStatus.color}`}>
                                            {projStatus.label}
                                        </span>
                                    </div>
                                    <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate flex items-center justify-between">
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-200 shrink-0">工程狀態</span>
                                        <span className={`ml-2 font-bold ${engStatus === "施工中" ? "text-blue-600 dark:text-blue-400" : engStatus === "已完工" ? "text-emerald-600 dark:text-emerald-500" : engStatus === "未進場(已到期)" ? "text-red-600 dark:text-red-500" : "text-zinc-600 dark:text-zinc-400"}`}>
                                            {engStatus}
                                        </span>
                                    </div>
                                    <div className="text-sm text-zinc-600 dark:text-zinc-400 truncate flex items-center justify-between">
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-200 shrink-0">掛表日期(預計)</span>
                                        <span className="text-zinc-700 dark:text-zinc-300 ml-2">
                                            {meterStep ? (meterStep.current_planned_end || meterStep.baseline_planned_end || "未填") : "無"}
                                        </span>
                                    </div>
                                </div>
                                {project.project_status === "已結案" && activeTab === "已結案" && (
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            onClick={(e) => handleReopenProject(e, project.project_id)}
                                            className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 rounded transition-colors"
                                        >
                                            退回 (恢復進行中)
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* 第一層彈窗 (簡要狀態) */}
            {selectedProject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 py-8 sm:p-6 overflow-y-auto">
                    <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm transition-opacity" onClick={closeMainModal} />
                    <div className="relative flex flex-col w-full max-w-2xl max-h-full overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-800">

                        <div className="flex-none items-center flex justify-between border-b border-zinc-100 bg-zinc-50/50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                            <div className="flex flex-col gap-3">
                                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 pr-8 flex flex-wrap items-center gap-3">
                                    <span>{selectedProject.project_name}</span>
                                    <span className="text-sm font-normal text-zinc-600 bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 px-2.5 py-0.5 rounded-md border border-zinc-300 dark:border-zinc-600 shrink-0">
                                        {selectedProject.kWp} Kwp
                                    </span>
                                </h2>
                                <div className="flex flex-wrap items-center gap-2">
                                    {/* 工程 */}
                                    <div className="flex items-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 overflow-hidden shadow-sm" title="工程負責人">
                                        <div className="bg-emerald-200 dark:bg-emerald-700/60 w-3 self-stretch" />
                                        <span className="px-2.5 py-1">{selectedProject.owners?.engineering || "未指定"}</span>
                                    </div>
                                    {/* 專案 */}
                                    <div className="flex items-center rounded-full border border-blue-200 bg-blue-50 text-xs font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 overflow-hidden shadow-sm" title="專案負責人">
                                        <div className="bg-blue-200 dark:bg-blue-700/60 w-3 self-stretch" />
                                        <span className="px-2.5 py-1">{selectedProject.owners?.pm || "未指定"}</span>
                                    </div>
                                    {/* 結構 */}
                                    <div className="flex items-center rounded-full border border-violet-200 bg-violet-50 text-xs font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-300 overflow-hidden shadow-sm" title="結構繪圖負責人">
                                        <div className="bg-violet-200 dark:bg-violet-700/60 w-3 self-stretch" />
                                        <span className="px-2.5 py-1">{selectedProject.owners?.structural || "未指定"}</span>
                                    </div>
                                    {/* 行政 */}
                                    <div className="flex items-center rounded-full border border-amber-200 bg-amber-50 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 overflow-hidden shadow-sm" title="行政負責人">
                                        <div className="bg-amber-200 dark:bg-amber-700/60 w-3 self-stretch" />
                                        <span className="px-2.5 py-1">{selectedProject.owners?.admin || "未指定"}</span>
                                    </div>
                                    {/* 業務 */}
                                    <div className="flex items-center rounded-full border border-rose-200 bg-rose-50 text-xs font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300 overflow-hidden shadow-sm" title="業務負責人">
                                        <div className="bg-rose-200 dark:bg-rose-700/60 w-3 self-stretch" />
                                        <span className="px-2.5 py-1">{selectedProject.owners?.sales || "未指定"}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={closeMainModal}
                                className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-50/30 dark:bg-zinc-900/10">
                            {(() => {
                                const currentIndex = getCurrentStepIndex(selectedProject);
                                const currentStep = selectedProject.steps[currentIndex];
                                const prevStep = currentIndex > 0 ? selectedProject.steps[currentIndex - 1] : null;
                                const nextStep = currentIndex < selectedProject.steps.length - 1 ? selectedProject.steps[currentIndex + 1] : null;

                                const agreeStep = selectedProject.steps.find(s => s.name.includes("同意"));
                                const enterStep = selectedProject.steps.find(s => s.name.includes("進場"));
                                const gridStep = selectedProject.steps.find(s => s.name.includes("掛表"));
                                const reviewStep = selectedProject.steps.find(s => s.name.includes("審查意見書"));

                                const getStepDateStr = (step?: any) => {
                                    if (!step) return "未填";
                                    if (step.actual_end) return `實際：${step.actual_end}`;
                                    if (step.current_planned_end) return `預計：${step.current_planned_end}`;
                                    return "未填";
                                };

                                const currentStatus = statusTexts[selectedProject.project_id] || { power: "", structure: "", admin: "", engineering: "" };
                                const handleStatusChange = (field: keyof typeof currentStatus, value: string) => {
                                    setStatusTexts({ ...statusTexts, [selectedProject.project_id]: { ...currentStatus, [field]: value } });
                                };

                                return (
                                    <>
                                        {/* 主要摘要區 (2 欄) */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* 目前與期限 */}
                                            <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col justify-center">
                                                <div className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-1">目前流程</div>
                                                <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-3 truncate" title={currentStep?.name || "無"}>
                                                    {currentStep?.name || "無"}
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-700/50">
                                                    <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <span className="truncate">到期：<span className="font-bold">{currentStep?.current_planned_end || currentStep?.baseline_planned_end || "無"}</span></span>
                                                </div>
                                            </div>

                                            {/* 前後流程 */}
                                            <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col justify-center gap-4">
                                                <div className="flex gap-3 items-start">
                                                    <div className="mt-0.5 shrink-0 bg-zinc-100 dark:bg-zinc-700 p-1.5 rounded-md text-zinc-500">
                                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">上一個流程</div>
                                                        <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 truncate" title={prevStep?.name || "無"}>
                                                            {prevStep?.name || "無"}
                                                        </div>
                                                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                            {prevStep ? (prevStep.actual_end ? `完成：${prevStep.actual_end}` : "實際：未完成") : ""}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="border-t border-zinc-100 dark:border-zinc-700/50" />
                                                <div className="flex gap-3 items-start">
                                                    <div className="mt-0.5 shrink-0 bg-blue-50 dark:bg-blue-900/30 p-1.5 rounded-md text-blue-600 dark:text-blue-400">
                                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">下一個流程</div>
                                                        <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 truncate" title={nextStep?.name || "無 (已到尾端)"}>
                                                            {nextStep?.name || "無 (已到尾端)"}
                                                        </div>
                                                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                                            {nextStep ? `預計：${nextStep.current_planned_end || nextStep.baseline_planned_end || "未填"}` : ""}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 狀況文字紀錄 */}
                                        <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                            <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-3 dark:border-zinc-700/50">
                                                <label className="flex items-center gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                                    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                    目前狀況 {isEditingStatus ? "" : "(僅顯示第一行)"}
                                                </label>
                                                <button
                                                    onClick={() => setIsEditingStatus(!isEditingStatus)}
                                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                                >
                                                    {isEditingStatus ? "完成編輯" : "查看/編輯全部"}
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                {[
                                                    { key: 'power', label: '電力狀況' },
                                                    { key: 'structure', label: '結構狀況' },
                                                    { key: 'admin', label: '行政狀況' },
                                                    { key: 'engineering', label: '工程狀況' }
                                                ].map(item => {
                                                    const val = currentStatus[item.key as keyof typeof currentStatus] || "";
                                                    return (
                                                        <div key={item.key} className={`flex ${isEditingStatus ? "flex-col gap-1" : "flex-row sm:items-center gap-2"}`}>
                                                            <span className="shrink-0 text-xs font-bold text-zinc-500 dark:text-zinc-400 w-16">{item.label}</span>
                                                            {isEditingStatus ? (
                                                                <textarea
                                                                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-lg p-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 min-h-[80px] resize-y"
                                                                    placeholder={`請輸入${item.label}...`}
                                                                    value={val}
                                                                    onChange={(e) => handleStatusChange(item.key as keyof typeof currentStatus, e.target.value)}
                                                                />
                                                            ) : (
                                                                <div className="flex-1 min-w-0 text-sm text-zinc-800 dark:text-zinc-200 truncate" title={val}>
                                                                    {val.split('\n')[0] || <span className="text-zinc-400 italic">未填寫</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* 關鍵日期區 */}
                                        <div>
                                            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-3 ml-1 flex items-center gap-2">
                                                <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                關鍵日期
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                                {[
                                                    { label: "審查意見書", step: reviewStep },
                                                    { label: "同意備案", step: agreeStep },
                                                    { label: "進場日期", step: enterStep },
                                                    { label: "掛表日期", step: gridStep },
                                                ].map((item, idx) => {
                                                    const isDone = !!item.step?.actual_end;
                                                    const dateStr = item.step?.actual_end || item.step?.current_planned_end || item.step?.baseline_planned_end || "未填";

                                                    return (
                                                        <div key={idx} className="bg-white dark:bg-zinc-800 px-4 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col justify-center">
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{item.label}</span>
                                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDone ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                                                                    {isDone ? "實際" : "預計"}
                                                                </span>
                                                            </div>
                                                            <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                                                                {dateStr}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        <div className="flex-none border-t border-zinc-200 bg-zinc-50/80 backdrop-blur-md px-6 py-4 flex justify-end gap-3 dark:border-zinc-800 dark:bg-zinc-900/80 sticky bottom-0">
                            <button
                                onClick={() => setShowDetailModal(true)}
                                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
                            >
                                詳細資訊 (完整流程)
                            </button>
                            <button
                                onClick={() => {
                                    const initialReasons: Record<string, string> = {};
                                    selectedProject.steps.filter(s => (s.delay_days ?? 0) > 0).forEach(s => {
                                        initialReasons[s.id] = s.delay_reason || "";
                                    });
                                    setCloseDelayReasons(initialReasons);
                                    setShowCloseModal(true);
                                }}
                                disabled={selectedProject.project_status === "已結案"}
                                className="rounded-lg bg-zinc-800 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                結案
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Project Detail Modal */}
            <ProjectDetailModal 
                isOpen={showDetailModal} 
                onClose={() => setShowDetailModal(false)}
                selectedProjectId={selectedProjectId}
                focusStepId={null}
                defaultTab={detailActiveTab}
            />

            {/* Create Project Wizard */}
            {isWizardOpen && newProjectTemp && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 py-8 sm:p-6 overflow-y-auto">
                    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsWizardOpen(false)} />
                    <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-800">
                        <div className="flex-none items-center flex justify-between border-b border-zinc-100 bg-zinc-50/50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                                建立新專案
                                <span className="text-sm font-normal text-zinc-500 bg-zinc-200/50 dark:bg-zinc-800 px-2 py-0.5 rounded">
                                    {wizardStep} / 2
                                </span>
                            </h2>
                            <button
                                onClick={() => setIsWizardOpen(false)}
                                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/30 dark:bg-zinc-900/10">
                            {wizardStep === 1 && (
                                <div className="space-y-6 max-w-xl mx-auto py-8">
                                    <div>
                                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">案件名稱 <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={newProjectTemp.project_name}
                                            onChange={(e) => setNewProjectTemp({ ...newProjectTemp, project_name: e.target.value })}
                                            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 shadow-sm transition-colors"
                                            placeholder="請輸入案件名稱 (必填)"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">建置容量 (Kwp)</label>
                                        <input
                                            type="number"
                                            value={newProjectTemp.kWp}
                                            onChange={(e) => setNewProjectTemp({ ...newProjectTemp, kWp: parseFloat(e.target.value) || 0 })}
                                            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 shadow-sm transition-colors"
                                            placeholder="例如：150"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 border-t border-zinc-200 dark:border-zinc-800 pt-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">工程負責人</label>
                                            <select
                                                value={newProjectTemp.owners?.engineering || ""}
                                                onChange={(e) => setNewProjectTemp({ ...newProjectTemp, owners: { ...newProjectTemp.owners, engineering: e.target.value } })}
                                                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                            >
                                                {MOCK_USERS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">專案負責人</label>
                                            <select
                                                value={newProjectTemp.owners?.pm || ""}
                                                onChange={(e) => setNewProjectTemp({ ...newProjectTemp, owners: { ...newProjectTemp.owners, pm: e.target.value } })}
                                                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                            >
                                                {MOCK_USERS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">結構繪圖負責人</label>
                                            <select
                                                value={newProjectTemp.owners?.structural || ""}
                                                onChange={(e) => setNewProjectTemp({ ...newProjectTemp, owners: { ...newProjectTemp.owners, structural: e.target.value } })}
                                                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                            >
                                                {MOCK_USERS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">行政負責人</label>
                                            <select
                                                value={newProjectTemp.owners?.admin || ""}
                                                onChange={(e) => setNewProjectTemp({ ...newProjectTemp, owners: { ...newProjectTemp.owners, admin: e.target.value } })}
                                                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                            >
                                                {MOCK_USERS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">業務負責人</label>
                                            <select
                                                value={newProjectTemp.owners?.sales || ""}
                                                onChange={(e) => setNewProjectTemp({ ...newProjectTemp, owners: { ...newProjectTemp.owners, sales: e.target.value } })}
                                                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                            >
                                                {MOCK_USERS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {wizardStep === 2 && (
                                <div className="space-y-4">
                                    <div className="mb-4 text-sm text-zinc-500">
                                        開案日: <span className="font-bold text-zinc-800 dark:text-zinc-200">{newProjectTemp.start_date}</span>
                                        <br />已預載主流程，可自由拖曳調整順序或修改日期，也能新增其他流程項目。
                                    </div>

                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white dark:bg-zinc-800 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 shrink-0">＋新增項目：</span>
                                        <select
                                            className="rounded flex-1 border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                            value={wizardSelectedNodeId}
                                            onChange={(e) => setWizardSelectedNodeId(e.target.value)}
                                        >
                                            <option value="">-- 請選擇流程庫項目 --</option>
                                            {availableNodesWizard.map(node => (
                                                <option key={node.id} value={node.id}>
                                                    {node.name} ({node.lane}) {node.is_core ? '' : '[可選]'}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={handleWizardAddStep}
                                            disabled={!wizardSelectedNodeId}
                                            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                                        >
                                            新增
                                        </button>
                                    </div>

                                    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
                                        <div className="overflow-x-auto max-h-[50vh]">
                                            <table className="w-full text-left text-sm whitespace-nowrap">
                                                <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
                                                    <tr>
                                                        <th className="px-4 py-3 font-semibold w-12 text-center">序號</th>
                                                        <th className="px-4 py-3 font-semibold min-w-[200px]">節點名稱</th>
                                                        <th className="px-4 py-3 font-semibold w-24 text-center">線別</th>
                                                        <th className="px-4 py-3 font-semibold w-24">Offset</th>
                                                        <th className="px-4 py-3 font-semibold w-32">原定 Baseline</th>
                                                        <th className="px-4 py-3 font-semibold w-20 text-center">操作</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                                    {newProjectTemp.steps.map((step, idx) => (
                                                        <tr
                                                            key={step.id}
                                                            className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${wizardDraggedStepIndex === idx ? 'opacity-50 bg-zinc-100 dark:bg-zinc-800' : ''}`}
                                                            draggable
                                                            onDragStart={(e) => {
                                                                setWizardDraggedStepIndex(idx);
                                                                e.dataTransfer.effectAllowed = "move";
                                                            }}
                                                            onDragOver={(e) => {
                                                                e.preventDefault();
                                                                e.dataTransfer.dropEffect = "move";
                                                            }}
                                                            onDrop={(e) => handleWizardDrop(e, idx)}
                                                            onDragEnd={() => setWizardDraggedStepIndex(null)}
                                                        >
                                                            <td className="px-4 py-3 text-center font-mono text-zinc-400 cursor-move" title="拖曳以排序">
                                                                <div className="flex items-center gap-1 justify-center">
                                                                    <svg className="w-4 h-4 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 8h16M4 16h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                                                                    {String(idx + 1).padStart(2, '0')}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{step.name}</td>
                                                            <td className="px-4 py-3 text-center text-zinc-500">{step.lane}</td>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="number"
                                                                    value={step.offset_days}
                                                                    onChange={(e) => handleWizardUpdateStep(step.id, "offset_days", e.target.value)}
                                                                    className="w-16 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-center text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{step.baseline_planned_end}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <button
                                                                    onClick={() => handleWizardRemoveStep(step.id)}
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10 p-1.5 rounded transition-colors"
                                                                >
                                                                    移除
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {newProjectTemp.steps.length === 0 && (
                                                        <tr>
                                                            <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                                                                目前無任何流程，請從上方新增。
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex-none border-t border-zinc-200 bg-zinc-50/80 px-6 py-4 flex justify-end gap-3 dark:border-zinc-800 dark:bg-zinc-900/80 sticky bottom-0">
                            {wizardStep === 1 && (
                                <>
                                    <button onClick={() => setIsWizardOpen(false)} className="rounded-lg px-6 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-colors">取消</button>
                                    <button
                                        onClick={handleWizardNext}
                                        disabled={!newProjectTemp.project_name}
                                        className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                                    >下一步</button>
                                </>
                            )}
                            {wizardStep === 2 && (
                                <>
                                    <button onClick={() => setWizardStep(1)} className="rounded-lg px-6 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-colors">上一步</button>
                                    <button
                                        onClick={handleWizardComplete}
                                        className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
                                    >完成建立</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
