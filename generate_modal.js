const fs = require('fs');
const content = fs.readFileSync('app/projects/page.tsx', 'utf8');

// We will construct ProjectDetailModal.tsx by extracting parts from page.tsx
let lines = content.split('\n');

// imports + Procurement Options + ProcureItemsBlock + getDaysDiff + addDays
const importsEndIndex = lines.findIndex(l => l.startsWith('export default function ProjectsPage()'));
const headerLines = lines.slice(0, importsEndIndex).join('\n');

const modalHeader = `
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
    const selectedProject = projects.find(p => p.project_id === selectedProjectId) || null;

    // Drag and Drop state
    const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
    // Add Item state
    const [selectedToAddNodeId, setSelectedToAddNodeId] = useState<string>("");

    // Delay Reason Modal state
    const [delayModalConfig, setDelayModalConfig] = useState<{ projectId: string, stepId: string, delay_override: boolean, delay_reason: string } | null>(null);

    // Complete Step Modal state
    const [completeModalConfig, setCompleteModalConfig] = useState<{ projectId: string, stepId: string, actualEnd: string, delayDays: number, delayReason: string, baselineEnd: string } | null>(null);

    // Edit Date Modal state (DateCorrectionLog)
    const [editDateModalConfig, setEditDateModalConfig] = useState<{ projectId: string, stepId: string, beforeEnd: string, afterEnd: string, note: string } | null>(null);

    // Show Corrections Modal state
    const [historyModalConfig, setHistoryModalConfig] = useState<{ stepName: string, corrections: DateCorrectionLog[] } | null>(null);

    // --- Second Level Detail Modal Tab State ---
    const [detailActiveTab, setDetailActiveTab] = useState<"流程" | "工程">(defaultTab);

    useEffect(() => {
        if (isOpen) {
            setDetailActiveTab(defaultTab);
        }
    }, [isOpen, defaultTab]);

    useEffect(() => {
        if (isOpen && focusStepId) {
            setTimeout(() => {
                const el = document.getElementById(\`step-row-\${focusStepId}\`);
                if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    el.classList.add("!bg-blue-100", "dark:!bg-blue-900/40", "transition-all", "duration-1000");
                    setTimeout(() => {
                        el.classList.remove("!bg-blue-100", "dark:!bg-blue-900/40");
                    }, 2000);
                }
            }, 100);
        }
    }, [isOpen, focusStepId]);

`;

// Extract functions like handleScroll... until the return statement
const returnStartIndex = lines.findIndex((l, i) => i > importsEndIndex && l.trim() === 'return (');
const stateFunctions = lines.slice(importsEndIndex + 1, returnStartIndex).join('\n');

// We want to keep only relevant handler functions (handleDragStart... handleRemoveStep... etc)
// And remove ProjectsPage specific handlers (handleAddProject, handleCloseProject)

// Then we find the second layer modal JSX within the return block
// It's under "第二層彈窗 (20 步詳細資訊與編輯)"
const detailModalStartStr = '{/* 第二層彈窗 (20 步詳細資訊與編輯) */}';
const detailModalStartIndex = lines.findIndex(l => l.includes(detailModalStartStr));

// It ends before "{/* C) 結案彈窗 */}"
const closeModalStartStr = '{/* C) 結案彈窗 */}';
const closeModalStartIndex = lines.findIndex(l => l.includes(closeModalStartStr));

let modalJsx = lines.slice(detailModalStartIndex, closeModalStartIndex).join('\n');

// Change `showDetailModal` to `isOpen` and `setShowDetailModal(false)` to `onClose()`
modalJsx = modalJsx.replace(/showDetailModal/g, 'isOpen').replace(/setShowDetailModal\(false\)/g, 'onClose()');

// Extract other modals (Delay Reason, Complete Step, Edit Actual End Date, History Records)
const delayModalStartStr = '{/* Delay Reason Modal (小彈窗) */}';
const delayModalStartIndex = lines.findIndex(l => l.includes(delayModalStartStr));

const wizardModalStartStr = '{/* Create Project Wizard */}';
const wizardModalStartIndex = lines.findIndex(l => l.includes(wizardModalStartStr));

let otherModalsJsx = lines.slice(delayModalStartIndex, wizardModalStartIndex).join('\n');


// Since JS string manipulation might break, we can just write out the modal component structure cleanly:
const newContent = `\${headerLines}
\${modalHeader}
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
        const val = Number(e.target.value);
        setScrollProgress(val);
        if (stepsScrollerRef.current) {
            const { scrollWidth, clientWidth } = stepsScrollerRef.current;
            const maxScroll = scrollWidth - clientWidth;
            stepsScrollerRef.current.scrollLeft = (val / 100) * maxScroll;
        }
    };

    const scrollByAmount = (amount: number) => {
        if (stepsScrollerRef.current) {
            stepsScrollerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
        }
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedStepIndex(index);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", index.toString());
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number, projectId: string) => {
        e.preventDefault();
        if (draggedStepIndex === null || draggedStepIndex === dropIndex) return;

        const project = projects.find(p => p.project_id === projectId);
        if (!project) return;

        const newSteps = [...project.steps];
        const [draggedItem] = newSteps.splice(draggedStepIndex, 1);
        newSteps.splice(dropIndex, 0, draggedItem);

        const updatedProject = { ...project, steps: newSteps };
        setProjects(projects.map(p => p.project_id === projectId ? updatedProject : p));
        setDraggedStepIndex(null);
    };

    const handleUpdateStepStatus = (projectId: string, stepId: string, newStatus: "未開始" | "進行中" | "卡關" | "完成") => {
        const project = projects.find(p => p.project_id === projectId);
        if (!project) return;
        const step = project.steps.find(s => s.id === stepId);
        if (!step) return;

        if (newStatus === "完成" && step.status !== "完成") {
            const todayStr = new Date().toISOString().split("T")[0];
            setCompleteModalConfig({
                projectId,
                stepId,
                actualEnd: todayStr,
                baselineEnd: step.baseline_planned_end || step.current_planned_end,
                delayDays: Math.max(0, getDaysDiff(step.baseline_planned_end || step.current_planned_end, todayStr)),
                delayReason: ""
            });
            return; // 阻止直接更新，改由彈窗處理
        }

        const newSteps = project.steps.map(s => {
            if (s.id === stepId) {
                return { ...s, status: newStatus };
            }
            return s;
        });
        setProjects(projects.map(p => p.project_id === projectId ? { ...p, steps: newSteps } : p));
    };

    const handleUpdateStep = (projectId: string, stepId: string, field: string, value: string) => {
        const project = projects.find(p => p.project_id === projectId);
        if (!project) return;

        const newSteps = project.steps.map(s => {
            if (s.id === stepId) {
                const updatedStep = { ...s, [field]: value };
                if (field === "offset_days") {
                    const parsedVal = parseInt(value, 10);
                    if (!isNaN(parsedVal) && project.start_date) {
                        updatedStep.current_planned_end = addDays(project.start_date, parsedVal);
                    }
                }
                return updatedStep;
            }
            return s;
        });
        setProjects(projects.map(p => p.project_id === projectId ? { ...p, steps: newSteps } : p));
    };

    const handleAddStep = (projectId: string) => {
        if (!selectedToAddNodeId) return;
        const project = projects.find(p => p.project_id === projectId);
        if (!project) return;

        const templateNode = flowTemplate.find(n => n.id === selectedToAddNodeId);
        if (!templateNode) return;

        const newStep = {
            id: \`custom-\${Date.now()}\`,
            name: templateNode.name,
            lane: templateNode.lane,
            status: "未開始" as const,
            offset_days: templateNode.offset_days || 0,
            baseline_planned_end: project.start_date ? addDays(project.start_date, templateNode.offset_days || 0) : "",
            current_planned_end: project.start_date ? addDays(project.start_date, templateNode.offset_days || 0) : ""
        };

        const updatedProject = { ...project, steps: [...project.steps, newStep] };
        setProjects(projects.map(p => p.project_id === projectId ? updatedProject : p));
        setSelectedToAddNodeId("");
    };

    const handleRemoveStep = (projectId: string, stepId: string) => {
        if (!confirm("確定要移除此流程項目？")) return;
        const project = projects.find(p => p.project_id === projectId);
        if (!project) return;

        const updatedProject = { ...project, steps: project.steps.filter(s => s.id !== stepId) };
        setProjects(projects.map(p => p.project_id === projectId ? updatedProject : p));
    };

    const handleSaveDelayReason = () => {
        if (!delayModalConfig) return;
        const { projectId, stepId, delay_override, delay_reason } = delayModalConfig;

        const project = projects.find(p => p.project_id === projectId);
        if (!project) return;

        const newSteps = project.steps.map(s => {
            if (s.id === stepId) {
                return { ...s, delay_override, delay_reason };
            }
            return s;
        });

        setProjects(projects.map(p => p.project_id === projectId ? { ...p, steps: newSteps } : p));
        setDelayModalConfig(null);
    };

    const handleConfirmComplete = () => {
        if (!completeModalConfig) return;
        const { projectId, stepId, actualEnd, delayDays, delayReason, baselineEnd } = completeModalConfig;

        const project = projects.find(p => p.project_id === projectId);
        if (!project) return;

        const newSteps = project.steps.map(s => {
            if (s.id === stepId) {
                const isDelayed = delayDays > 0;
                return {
                    ...s,
                    status: "完成" as const,
                    actual_end: actualEnd,
                    delay_days: delayDays,
                    delay_override: isDelayed,
                    delay_reason: delayReason
                };
            }
            return s;
        });

        setProjects(projects.map(p => p.project_id === projectId ? { ...p, steps: newSteps } : p));
        setCompleteModalConfig(null);
    };

    const handleSaveDateCorrection = () => {
        if (!editDateModalConfig) return;
        const { projectId, stepId, beforeEnd, afterEnd, note } = editDateModalConfig;

        const project = projects.find(p => p.project_id === projectId);
        if (!project) return;

        const newSteps = project.steps.map(s => {
            if (s.id === stepId) {
                const diff = getDaysDiff(s.baseline_planned_end || s.current_planned_end, afterEnd);
                const delay_days = Math.max(0, diff);

                const newLog: DateCorrectionLog = {
                    id: \`corr-\${Date.now()}\`,
                    field: "actual_end",
                    before: beforeEnd,
                    after: afterEnd,
                    corrected_at: new Date().toISOString(),
                    corrected_by: "當前用戶",
                    note: note
                };

                return {
                    ...s,
                    actual_end: afterEnd,
                    delay_days,
                    delay_override: delay_days > 0,
                    corrections: [...(s.corrections || []), newLog]
                };
            }
            return s;
        });

        setProjects(projects.map(p => p.project_id === projectId ? { ...p, steps: newSteps } : p));
        setEditDateModalConfig(null);
    };

    if (!isOpen || !selectedProject) return null;

    const availableNodesToAdd = flowTemplate.filter(node => !selectedProject.steps.some(s => s.name === node.name));

    return (
        <>
            \${modalJsx}
            \${otherModalsJsx}
        </>
    );
}
\`;

fs.writeFileSync('app/components/ProjectDetailModal.tsx', newContent);
