"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ProjectFlowPlan, createProjectFlowPlan, DateCorrectionLog } from "../../lib/mock/project_flow_plan";
import { flowTemplate, FlowNode } from "../../lib/mock/flow_template";

import { PeopleByDept, VendorsByType, useProjects } from "../providers/projects-store";
import ProjectDetailModal from "../components/ProjectDetailModal";
import BatchImportModal from "./components/BatchImportModal";
import * as projectsRepo from "../../lib/repositories/projects";


export default function ProjectsPage() {
    const {
        projects, setProjects,
        peopleByDept, vendorsByType,
        flowTemplateOrder, isMounted
    } = useProjects();

    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailDefaultTab, setDetailDefaultTab] = useState<"流程" | "工程">("流程");
    const [activeTab, setActiveTab] = useState<"全部" | "警示及重要案件" | "商用案" | "一般案" | "已掛表" | "已結案">("全部");
    const [statusTexts, setStatusTexts] = useState<Record<string, { power: string, structure: string, admin: string, engineering: string }>>({});
    const [isEditingStatus, setIsEditingStatus] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [closeDelayReasons, setCloseDelayReasons] = useState<Record<string, string>>({});
    const [viewMode, setViewMode] = useState<"card" | "excel">("card");
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [currentStatus, setCurrentStatus] = useState({ power: '', structure: '', admin: '', engineering: '' });

    // --- Inline Edit State ---
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>("");

    const handleStartEdit = (field: string, value: string) => {
        setEditingField(field);
        setEditValue(value);
    };

    const handleSaveEdit = (value?: string) => {
        if (!selectedProject || !editingField) return;
        const valToSave = value !== undefined ? value : editValue;

        let updatePatch: any = {};
        if (editingField === "kWp") {
            const val = parseFloat(valToSave) || 0;
            updatePatch = { kWp: val };
        } else if (editingField.startsWith("owner_")) {
            const role = editingField.replace("owner_", "");
            updatePatch = {
                owners: {
                    ...(selectedProject.owners || {}),
                    [role]: valToSave || undefined
                }
            };
        }

        setProjects(prev => prev.map(p =>
            p.project_id === selectedProject.project_id ? { ...p, ...updatePatch } : p
        ));
        setEditingField(null);
    };

    const handleCancelEdit = () => setEditingField(null);

    // --- Create Wizard State ---
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState<1 | 2>(1);
    const [newProjectTemp, setNewProjectTemp] = useState<ProjectFlowPlan | null>(null);
    const [wizardDraggedStepIndex, setWizardDraggedStepIndex] = useState<number | null>(null);
    const [wizardSelectedNodeId, setWizardSelectedNodeId] = useState<string>("");

    const selectedProject = useMemo(() => projects.find(p => p.project_id === selectedProjectId) || null, [projects, selectedProjectId]);

    const closeMainModal = () => setSelectedProjectId(null);

    // Synchronization for horizontal scrolling
    const stepsScrollerRef = useRef<HTMLDivElement>(null);
    const [scrollProgress, setScrollProgress] = useState(0);

    // Initial load from URL and hydration guard
    useEffect(() => {
        if (!isMounted || typeof window === "undefined") return;
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
                    setDetailDefaultTab("流程");
                } else if (tab === "engineering") {
                    setDetailDefaultTab("工程");
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
    }, [isMounted, projects]);

    // Update currentStatus when selectedProject changes
    useEffect(() => {
        if (selectedProject) {
            setCurrentStatus({
                power: (selectedProject.owners as any)?.status_power || '',
                structure: (selectedProject.owners as any)?.status_structure || '',
                admin: (selectedProject.owners as any)?.status_admin || '',
                engineering: (selectedProject.owners as any)?.status_engineering || '',
            });
        }
    }, [selectedProject]);

    const handleStatusChange = (field: keyof typeof currentStatus, value: string) => {
        setCurrentStatus(prev => ({ ...prev, [field]: value }));
    };

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

    // --- Helper functions ---
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
                const prevStep = newSteps[i - 1];
                const prevDate = prevStep.status === "完成" && prevStep.actual_end ? prevStep.actual_end : prevStep.current_planned_end;
                const shift = getDaysDiff(prevStep.baseline_planned_end, prevDate);
                if (shift > maxDelayShift) maxDelayShift = shift;
            }
            const baselineDate = addDays(project.start_date, step.offset_days);
            newSteps[i] = { ...step, baseline_planned_end: baselineDate, current_planned_end: addDays(baselineDate, maxDelayShift) };
        }
        return { ...project, steps: newSteps };
    };

    const handleConfirmClose = () => {
        if (!selectedProject) return;

        // 檢查是否有延遲項目未填原因
        const delayedSteps = selectedProject.steps.filter(s => (s.delay_days ?? 0) > 0);
        const missingReason = delayedSteps.some(s => !closeDelayReasons[s.id]?.trim());

        if (missingReason) {
            alert("請完整填寫所有延遲項目的延遲原因！");
            return;
        }

        setProjects(prev => prev.map(p => {
            if (p.project_id !== selectedProject.project_id) return p;

            // 更新步驟中的延遲原因
            const updatedSteps = p.steps.map(s => ({
                ...s,
                delay_reason: closeDelayReasons[s.id] || s.delay_reason
            }));

            return {
                ...p,
                project_status: "已結案" as const,
                steps: updatedSteps,
                updated_at: new Date().toISOString()
            };
        }));

        setShowCloseModal(false);
        setSelectedProjectId(null); // 結案後關閉摘要視窗
    };

    // --- Helpers (hoisted as function declarations to avoid TDZ) ---
    const METER_STEP_ID = "P-007";

    function isMeteredProject(project: ProjectFlowPlan) {
        const step = project.steps.find(s => s.id === METER_STEP_ID);
        if (!step) return false;
        if (step.status !== "完成") return false;
        if (!step.actual_end || step.actual_end.trim() === "") return false;
        return true;
    }

    function getCurrentStepIndex(project: ProjectFlowPlan) {
        const idx = project.steps.findIndex(s => s.status === "進行中");
        return idx !== -1 ? idx : (project.steps.length > 0 && project.steps[project.steps.length - 1].status === "完成" ? project.steps.length - 1 : 0);
    }

    function isWarningProject(project: ProjectFlowPlan) {
        const todayStr = new Date().toISOString().split("T")[0];
        const currentIndex = getCurrentStepIndex(project);
        const currentStep = project.steps[currentIndex];

        if (currentStep && currentStep.status !== "完成" && getDaysDiff(todayStr, currentStep.current_planned_end) < 0) {
            return true;
        }

        const hasUnexplainedDelay = project.steps.some(s =>
            s.delay_days && s.delay_days > 0 && !s.delay_reason
        );
        if (hasUnexplainedDelay) return true;

        return false;
    }

    // --- Filtered Projects ---
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            if (activeTab === "全部") return p.project_status !== "已結案";
            if (activeTab === "警示及重要案件") return p.project_status !== "已結案" && (isWarningProject(p) || p.isImportant);
            if (activeTab === "商用案") return p.project_status !== "已結案" && (p.kWp || 0) >= 100;
            if (activeTab === "一般案") return p.project_status !== "已結案" && (p.kWp || 0) < 100;
            if (activeTab === "已掛表") return p.project_status !== "已結案" && isMeteredProject(p);
            if (activeTab === "已結案") return p.project_status === "已結案";
            return true;
        });
    }, [projects, activeTab]);

    // --- Event Handlers ---
    const handleToggleImportant = (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        setProjects(prev => prev.map(p => p.project_id === projectId ? { ...p, isImportant: !p.isImportant } : p));
    };

    const handleReopenProject = (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        setProjects(prev => prev.map(p => p.project_id === projectId ? { ...p, project_status: "進行中" } : p));
    };

    const handleDeleteProject = () => {
        if (!selectedProject) return;
        if (window.confirm(`確定要刪除專案「${selectedProject.project_name}」嗎？此操作無法還原。`)) {
            setProjects(prev => prev.filter(p => p.project_id !== selectedProject.project_id));
            setSelectedProjectId(null);
        }
    };

    const handleEditProjectName = () => {
        if (!selectedProject) return;
        const newName = window.prompt("請輸入新的案場名稱：", selectedProject.project_name);
        if (newName !== null && newName.trim() !== "") {
            setProjects(prev => prev.map(p =>
                p.project_id === selectedProject.project_id ? { ...p, project_name: newName.trim() } : p
            ));
        }
    };


    // --- Filter out available nodes to add ---
    const availableNodesToAdd = selectedProject
        ? flowTemplateOrder.filter(node => !selectedProject.steps.some(s => s.id === node.id) && !node.is_archived)
        : [];

    const availableNodesWizard = newProjectTemp
        ? flowTemplateOrder.filter(node => !newProjectTemp.steps.some(s => s.id === node.id) && !node.is_archived)
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
            // Generate steps from flowTemplateOrder (Master Flow)
            const coreFlows = flowTemplateOrder.filter(node => node.is_core);
            const steps: any[] = coreFlows.map((node, index) => ({
                id: node.id,
                name: node.name,
                lane: node.lane,
                offset_days: node.offset_days,
                baseline_planned_end: addDays(newProjectTemp.start_date, node.offset_days),
                current_planned_end: addDays(newProjectTemp.start_date, node.offset_days),
                status: index === 0 ? "進行中" : "未開始",
                updated_at: new Date().toISOString()
            }));
            setNewProjectTemp({ ...newProjectTemp, steps });
        }
        setWizardStep(2);
    };

    const handleWizardComplete = async () => {
        if (!newProjectTemp) return;

        try {
            // Write to Supabase 
            const dbProject = await projectsRepo.createProject({
                name: newProjectTemp.project_name,
                kwp: newProjectTemp.kWp || 0,
                engineer_id: null,
                project_manager_id: null,
                sales_id: null,
                structure_id: null,
                admin_id: null,
                structure_vendor_id: null,
                electrical_vendor_id: null,
                current_step_key: null,
                next_step_key: null,
                projected_meter_date: null,
                owners: newProjectTemp.owners || {},
                status_flag: newProjectTemp.project_status
            });

            // Write all steps to Supabase
            const stepsToInsert = newProjectTemp.steps.map((s, idx) => ({
                project_id: dbProject.id,
                template_step_key: s.id,
                step_name: s.name,
                owner_role: s.lane,
                sort_order: idx + 1,
                baseline_date: s.baseline_planned_end,
                current_planned_date: s.current_planned_end,
                actual_date: null,
                status: s.status,
                delay_reason: null,
                metadata: {
                    offset_days: s.offset_days || 0
                }
            }));

            // Ideally this would be a bulk insert but loop map is fine for ~20 rows MVP
            await Promise.all(stepsToInsert.map(step => projectsRepo.addProjectStep(step)));

            // Update UI with DB ID
            const uiProject = { ...newProjectTemp, project_id: dbProject.id };
            setProjects(prev => [uiProject, ...prev]);
            setIsWizardOpen(false);
            setNewProjectTemp(null);
            setActiveTab("全部");
        } catch (e) {
            const error = e as any;
            console.error("Failed to create project to Supabase:", {
                message: error?.message,
                details: error?.details,
                hint: error?.hint,
                code: error?.code,
                status: error?.status,
            });
            alert("建立專案失敗，請重試");
        }
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
        const nodeToAdd = flowTemplateOrder.find(n => n.id === wizardSelectedNodeId);
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

    if (!isMounted) {
        return <div className="p-8 text-center text-gray-500">載入中...</div>;
    }

    return (
        <div className="container mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
            {/* Top Bar... */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    專案狀態
                </h1>
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 mr-2">
                        <button
                            onClick={() => setViewMode("card")}
                            className={`p-1.5 rounded-md transition-all ${viewMode === "card" ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
                            title="卡片視圖"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setViewMode("excel")}
                            className={`p-1.5 rounded-md transition-all ${viewMode === "excel" ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
                            title="Excel列表視圖"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                    </div>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                    >
                        匯入
                    </button>
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

            {viewMode === "card" ? (
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
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-700/50 flex-1">
                                        <div className="col-span-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">專案摘要</div>

                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">目前流程</span>
                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">{currentStep?.name || "無"}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">掛表日期(預計)</span>
                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                                {meterStep ? (meterStep.current_planned_end || meterStep.baseline_planned_end || "未填") : "無"}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">下一步流程</span>
                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">{nextStep?.name || "無"}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">工程狀態</span>
                                            <span className={`text-sm font-bold ${engStatus === "施工中" ? "text-blue-600 dark:text-blue-400" : engStatus === "已完工" ? "text-emerald-600 dark:text-emerald-500" : engStatus === "未進場(已到期)" ? "text-red-600 dark:text-red-500" : "text-zinc-600 dark:text-zinc-400"}`}>
                                                {engStatus}
                                            </span>
                                        </div>
                                        <div className="col-span-2 flex items-center justify-between mt-1 pt-2 border-t border-zinc-100 dark:border-zinc-700/50">
                                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">專案狀態</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${projStatus.color}`}>
                                                {projStatus.label}
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
            ) : (
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-center w-24">狀態</th>
                                    <th className="px-4 py-3 font-semibold min-w-[200px]">案件名稱</th>
                                    <th className="px-4 py-3 font-semibold text-center w-20">kWp</th>
                                    <th className="px-4 py-3 font-semibold w-24">工程負責</th>
                                    <th className="px-4 py-3 font-semibold min-w-[150px]">目前流程</th>
                                    <th className="px-4 py-3 font-semibold min-w-[150px]">下一步</th>
                                    <th className="px-4 py-3 font-semibold w-32">掛表日期(預計)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {filteredProjects.map((project) => {
                                    const currentIndex = getCurrentStepIndex(project);
                                    const currentStep = project.steps[currentIndex];
                                    const nextStep = project.steps[currentIndex + 1];
                                    const meterStep = project.steps.find(s => s.id === METER_STEP_ID);

                                    let projStatus = { label: "正常", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50" };
                                    if (project.project_status === "已結案") {
                                        projStatus = { label: "已結案", color: "text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700" };
                                    } else {
                                        const isWarning = project.steps.some(s => {
                                            if (s.status !== "完成") {
                                                const planned = s.current_planned_end || s.baseline_planned_end;
                                                const todayStr = new Date().toISOString().split("T")[0];
                                                return planned && todayStr > planned;
                                            }
                                            return (s.delay_days ?? 0) > 0 && !s.delay_reason;
                                        });
                                        if (isWarning) projStatus = { label: "警示", color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/50" };
                                        else if (project.isImportant) projStatus = { label: "重要", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50" };
                                    }

                                    return (
                                        <tr
                                            key={project.project_id}
                                            onClick={() => setSelectedProjectId(project.project_id)}
                                            className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                        >
                                            <td className="px-4 py-3 text-center">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block min-w-[50px] ${projStatus.color}`}>
                                                    {projStatus.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {project.isImportant && (
                                                        <svg className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                                        </svg>
                                                    )}
                                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[300px]" title={project.project_name}>
                                                        {project.project_name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400 font-mono">{project.kWp}</td>
                                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{project.owners?.engineering || "未指定"}</td>
                                            <td className="px-4 py-3">
                                                <span className="text-zinc-700 dark:text-zinc-300 truncate inline-block max-w-[150px]" title={currentStep?.name}>{currentStep?.name || "無"}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-zinc-500 dark:text-zinc-500 truncate inline-block max-w-[150px]" title={nextStep?.name}>{nextStep?.name || "無"}</span>
                                            </td>
                                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                                                {meterStep ? (meterStep.current_planned_end || meterStep.baseline_planned_end || "-") : "-"}
                                            </td>

                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 第一層彈窗 (簡要狀態) */}
            {selectedProject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 py-8 sm:p-6 overflow-y-auto">
                    <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm transition-opacity" onClick={closeMainModal} />
                    <div className="relative flex flex-col w-full max-w-2xl max-h-full overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-800">

                        <div className="flex-none items-center flex justify-between border-b border-zinc-100 bg-zinc-50/50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                            <div className="flex flex-col gap-3">
                                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 pr-8 flex flex-wrap items-center gap-3">
                                    <span>{selectedProject.project_name}</span>
                                    <button onClick={handleEditProjectName} className="text-zinc-400 hover:text-blue-500 transition-colors" title="修改案名">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <span className="text-sm font-normal text-zinc-600 bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 px-2.5 py-0.5 rounded-md border border-zinc-300 dark:border-zinc-600 shrink-0 select-none">
                                        {editingField === "kWp" ? (
                                            <input
                                                type="number"
                                                autoFocus
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={() => handleSaveEdit()}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleSaveEdit();
                                                    if (e.key === "Escape") handleCancelEdit();
                                                }}
                                                className="w-20 bg-white dark:bg-zinc-800 border-none outline-none py-0 px-1 text-zinc-900 dark:text-zinc-100"
                                            />
                                        ) : (
                                            <span onDoubleClick={() => handleStartEdit("kWp", String(selectedProject.kWp))}>
                                                {selectedProject.kWp} Kwp
                                            </span>
                                        )}
                                    </span>
                                </h2>
                                <div className="flex flex-wrap items-center gap-2">
                                    {/* 工程 */}
                                    <div
                                        className="flex items-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 overflow-hidden shadow-sm select-none cursor-default"
                                        title="雙擊編輯：工程負責人"
                                        onDoubleClick={() => handleStartEdit("owner_engineering", selectedProject.owners?.engineering || "")}
                                    >
                                        <div className="bg-emerald-200 dark:bg-emerald-700/60 w-3 self-stretch" />
                                        {editingField === "owner_engineering" ? (
                                            <select
                                                autoFocus
                                                value={editValue}
                                                onChange={(e) => handleSaveEdit(e.target.value)}
                                                onBlur={() => handleSaveEdit()}
                                                className="bg-transparent border-none outline-none py-1 pl-1 pr-1"
                                            >
                                                <option value="">未指定</option>
                                                {peopleByDept["工程"]?.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                            </select>
                                        ) : (
                                            <span className="px-2.5 py-1">{selectedProject.owners?.engineering || "未指定"}</span>
                                        )}
                                    </div>
                                    {/* 專案 */}
                                    <div
                                        className="flex items-center rounded-full border border-blue-200 bg-blue-50 text-xs font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 overflow-hidden shadow-sm select-none cursor-default"
                                        title="雙擊編輯：專案負責人"
                                        onDoubleClick={() => handleStartEdit("owner_pm", selectedProject.owners?.pm || "")}
                                    >
                                        <div className="bg-blue-200 dark:bg-blue-700/60 w-3 self-stretch" />
                                        {editingField === "owner_pm" ? (
                                            <select
                                                autoFocus
                                                value={editValue}
                                                onChange={(e) => handleSaveEdit(e.target.value)}
                                                onBlur={() => handleSaveEdit()}
                                                className="bg-transparent border-none outline-none py-1 pl-1 pr-1"
                                            >
                                                <option value="">未指定</option>
                                                {peopleByDept["專案"]?.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                            </select>
                                        ) : (
                                            <span className="px-2.5 py-1">{selectedProject.owners?.pm || "未指定"}</span>
                                        )}
                                    </div>
                                    {/* 結構 */}
                                    <div
                                        className="flex items-center rounded-full border border-violet-200 bg-violet-50 text-xs font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-300 overflow-hidden shadow-sm select-none cursor-default"
                                        title="雙擊編輯：結構負責人"
                                        onDoubleClick={() => handleStartEdit("owner_structural", selectedProject.owners?.structural || "")}
                                    >
                                        <div className="bg-violet-200 dark:bg-violet-700/60 w-3 self-stretch" />
                                        {editingField === "owner_structural" ? (
                                            <select
                                                autoFocus
                                                value={editValue}
                                                onChange={(e) => handleSaveEdit(e.target.value)}
                                                onBlur={() => handleSaveEdit()}
                                                className="bg-transparent border-none outline-none py-1 pl-1 pr-1"
                                            >
                                                <option value="">未指定</option>
                                                {peopleByDept["結構"]?.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                            </select>
                                        ) : (
                                            <span className="px-2.5 py-1">{selectedProject.owners?.structural || "未指定"}</span>
                                        )}
                                    </div>
                                    {/* 行政 */}
                                    <div
                                        className="flex items-center rounded-full border border-amber-200 bg-amber-50 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 overflow-hidden shadow-sm select-none cursor-default"
                                        title="雙擊編輯：行政負責人"
                                        onDoubleClick={() => handleStartEdit("owner_admin", selectedProject.owners?.admin || "")}
                                    >
                                        <div className="bg-amber-200 dark:bg-amber-700/60 w-3 self-stretch" />
                                        {editingField === "owner_admin" ? (
                                            <select
                                                autoFocus
                                                value={editValue}
                                                onChange={(e) => handleSaveEdit(e.target.value)}
                                                onBlur={() => handleSaveEdit()}
                                                className="bg-transparent border-none outline-none py-1 pl-1 pr-1"
                                            >
                                                <option value="">未指定</option>
                                                {peopleByDept["行政"]?.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                            </select>
                                        ) : (
                                            <span className="px-2.5 py-1">{selectedProject.owners?.admin || "未指定"}</span>
                                        )}
                                    </div>
                                    {/* 業務 */}
                                    <div
                                        className="flex items-center rounded-full border border-rose-200 bg-rose-50 text-xs font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300 overflow-hidden shadow-sm select-none cursor-default"
                                        title="雙擊編輯：業務負責人"
                                        onDoubleClick={() => handleStartEdit("owner_sales", selectedProject.owners?.sales || "")}
                                    >
                                        <div className="bg-rose-200 dark:bg-rose-700/60 w-3 self-stretch" />
                                        {editingField === "owner_sales" ? (
                                            <select
                                                autoFocus
                                                value={editValue}
                                                onChange={(e) => handleSaveEdit(e.target.value)}
                                                onBlur={() => handleSaveEdit()}
                                                className="bg-transparent border-none outline-none py-1 pl-1 pr-1"
                                            >
                                                <option value="">未指定</option>
                                                {peopleByDept["業務"]?.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                            </select>
                                        ) : (
                                            <span className="px-2.5 py-1">{selectedProject.owners?.sales || "未指定"}</span>
                                        )}
                                    </div>
                                </div>

                                {/* 廠商資訊 */}
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    {/* 結構包商 */}
                                    <div
                                        className="flex items-center rounded-full border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 overflow-hidden shadow-sm select-none cursor-default"
                                        title="雙擊編輯：結構包商"
                                        onDoubleClick={() => handleStartEdit("owner_vendor_structure", selectedProject.owners?.vendor_structure || "")}
                                    >
                                        <div className="bg-zinc-200 dark:bg-zinc-700 w-3 self-stretch" />
                                        <span className="px-2 py-1 text-[10px] text-zinc-400 font-bold uppercase tracking-wider border-r border-zinc-200 dark:border-zinc-700">結構包商</span>
                                        {editingField === "owner_vendor_structure" ? (
                                            <select
                                                autoFocus
                                                value={editValue}
                                                onChange={(e) => handleSaveEdit(e.target.value)}
                                                onBlur={() => handleSaveEdit()}
                                                className="bg-transparent border-none outline-none py-1 pl-1 pr-1"
                                            >
                                                <option value="">未指定</option>
                                                {vendorsByType["鋼構"]?.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                            </select>
                                        ) : (
                                            <span className="px-2.5 py-1">{selectedProject.owners?.vendor_structure || "未指定"}</span>
                                        )}
                                    </div>
                                    {/* 電力包商 */}
                                    <div
                                        className="flex items-center rounded-full border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 overflow-hidden shadow-sm select-none cursor-default"
                                        title="雙擊編輯：電力包商"
                                        onDoubleClick={() => handleStartEdit("owner_vendor_power", selectedProject.owners?.vendor_power || "")}
                                    >
                                        <div className="bg-zinc-200 dark:bg-zinc-700 w-3 self-stretch" />
                                        <span className="px-2 py-1 text-[10px] text-zinc-400 font-bold uppercase tracking-wider border-r border-zinc-200 dark:border-zinc-700">電力包商</span>
                                        {editingField === "owner_vendor_power" ? (
                                            <select
                                                autoFocus
                                                value={editValue}
                                                onChange={(e) => handleSaveEdit(e.target.value)}
                                                onBlur={() => handleSaveEdit()}
                                                className="bg-transparent border-none outline-none py-1 pl-1 pr-1"
                                            >
                                                <option value="">未指定</option>
                                                {vendorsByType["電力"]?.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                            </select>
                                        ) : (
                                            <span className="px-2.5 py-1">{selectedProject.owners?.vendor_power || "未指定"}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="absolute right-16 top-4 flex items-center gap-2">
                                {selectedProject.project_status === "已結案" && (
                                    <button
                                        onClick={handleDeleteProject}
                                        className="rounded bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 px-3 py-1.5 text-sm font-semibold transition-colors border border-red-200 dark:border-red-800"
                                    >
                                        刪除專案
                                    </button>
                                )}
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

                                        {/* 狀況文字紀錄 - 兩欄版型 */}
                                        <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                            <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-4 dark:border-zinc-700/50">
                                                <label className="flex items-center gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                                    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                    日前狀況
                                                </label>
                                                <button
                                                    onClick={async () => {
                                                        if (isEditingStatus) {
                                                            // Save to Database
                                                            try {
                                                                await projectsRepo.updateProjectBasicInfo(selectedProject.project_id, {
                                                                    owners: {
                                                                        ...(selectedProject.owners || {}),
                                                                        status_power: currentStatus.power,
                                                                        status_structure: currentStatus.structure,
                                                                        status_admin: currentStatus.admin,
                                                                        status_engineering: currentStatus.engineering,
                                                                    }
                                                                });
                                                                // Update local state in store
                                                                setProjects(prev => prev.map(p => p.project_id === selectedProject.project_id ? {
                                                                    ...p,
                                                                    owners: {
                                                                        ...(p.owners || {}),
                                                                        status_power: currentStatus.power,
                                                                        status_structure: currentStatus.structure,
                                                                        status_admin: currentStatus.admin,
                                                                        status_engineering: currentStatus.engineering,
                                                                    }
                                                                } : p));
                                                            } catch (err) {
                                                                alert("儲存狀況失敗");
                                                            }
                                                        }
                                                        setIsEditingStatus(!isEditingStatus);
                                                    }}
                                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded"
                                                >
                                                    {isEditingStatus ? "儲存並關閉" : "編輯狀況"}
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {[
                                                    { key: 'power', label: '電力狀況', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                                                    { key: 'structure', label: '結構狀況', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
                                                    { key: 'admin', label: '行政狀況', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                                                    { key: 'engineering', label: '工程狀況', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z' }
                                                ].map(item => {
                                                    const val = currentStatus[item.key as keyof typeof currentStatus] || selectedProject.owners?.[`status_${item.key}` as keyof typeof selectedProject.owners] || "";
                                                    return (
                                                        <div key={item.key} className="flex flex-col gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-700/50">
                                                            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                                                                </svg>
                                                                {item.label}
                                                            </div>
                                                            {isEditingStatus ? (
                                                                <textarea
                                                                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 rounded-lg p-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[60px] resize-none"
                                                                    placeholder={`請輸入${item.label}...`}
                                                                    value={val}
                                                                    onChange={(e) => handleStatusChange(item.key as keyof typeof currentStatus, e.target.value)}
                                                                />
                                                            ) : (
                                                                <div className="text-sm text-zinc-800 dark:text-zinc-200 line-clamp-3 min-h-[40px]" title={val}>
                                                                    {val || <span className="text-zinc-400 italic font-normal">未填寫</span>}
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
                defaultTab={detailDefaultTab}
            />

            {/* Project Close Modal */}
            {showCloseModal && selectedProject && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={() => setShowCloseModal(false)} />
                    <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">確認結案：{selectedProject.project_name}</h3>
                            <button onClick={() => setShowCloseModal(false)} className="text-zinc-400 hover:text-zinc-500">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex gap-3">
                                <svg className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                <div>
                                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400">結案注意事項</h4>
                                    <p className="text-xs text-amber-700/80 dark:text-amber-500/80 mt-1 leading-relaxed">
                                        請確認所有流程已完成。若有延遲項目，請務必填寫延遲原因。結案後專案將移至「已結案」清單。
                                    </p>
                                </div>
                            </div>

                            {/* 延遲項目清單 */}
                            <div>
                                <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
                                    <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-1.5 py-0.5 rounded">必填</span>
                                    延遲項目原因填寫
                                </h4>
                                <div className="space-y-4">
                                    {selectedProject.steps.filter(s => (s.delay_days ?? 0) > 0).length === 0 ? (
                                        <div className="text-center py-8 text-zinc-500 text-sm italic bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
                                            此專案無延遲項目，表現優異！
                                        </div>
                                    ) : (
                                        selectedProject.steps.filter(s => (s.delay_days ?? 0) > 0).map(step => (
                                            <div key={step.id} className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 shadow-sm">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{step.name}</span>
                                                    <span className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                                                        延遲 {step.delay_days} 天
                                                    </span>
                                                </div>
                                                <textarea
                                                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[80px]"
                                                    placeholder="請輸入延遲原因..."
                                                    value={closeDelayReasons[step.id] || ""}
                                                    onChange={(e) => setCloseDelayReasons(prev => ({ ...prev, [step.id]: e.target.value }))}
                                                />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
                            <button
                                onClick={() => setShowCloseModal(false)}
                                className="px-6 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                            >
                                我再檢查一下
                            </button>
                            <button
                                onClick={handleConfirmClose}
                                className="px-8 py-2.5 text-sm font-bold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white rounded-xl transition-colors shadow-lg shadow-zinc-900/10"
                            >
                                確認結案
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                                <option value="">-- 未指定 --</option>
                                                {peopleByDept["工程"].map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">專案負責人</label>
                                            <select
                                                value={newProjectTemp.owners?.pm || ""}
                                                onChange={(e) => setNewProjectTemp({ ...newProjectTemp, owners: { ...newProjectTemp.owners, pm: e.target.value } })}
                                                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                            >
                                                <option value="">-- 未指定 --</option>
                                                {peopleByDept["專案"].map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">業務負責人</label>
                                            <select
                                                value={newProjectTemp.owners?.sales || ""}
                                                onChange={(e) => setNewProjectTemp({ ...newProjectTemp, owners: { ...newProjectTemp.owners, sales: e.target.value } })}
                                                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                            >
                                                <option value="">-- 未指定 --</option>
                                                {peopleByDept["業務"].map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">結構包商</label>
                                            <select
                                                value={newProjectTemp.owners?.vendor_structure || ""}
                                                onChange={(e) => setNewProjectTemp({ ...newProjectTemp, owners: { ...newProjectTemp.owners, vendor_structure: e.target.value } })}
                                                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                            >
                                                <option value="">-- 未指定 --</option>
                                                {vendorsByType["鋼構"].map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">電力包商</label>
                                            <select
                                                value={newProjectTemp.owners?.vendor_power || ""}
                                                onChange={(e) => setNewProjectTemp({ ...newProjectTemp, owners: { ...newProjectTemp.owners, vendor_power: e.target.value } })}
                                                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                            >
                                                <option value="">-- 未指定 --</option>
                                                {vendorsByType["電力"].map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
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
            {/* 批次匯入彈窗 */}
            {isImportModalOpen && (
                <BatchImportModal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                />
            )}
        </div>
    );
}

