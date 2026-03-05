"use client";

import { useState, Fragment } from "react";
import { flowTemplate, FlowNode } from "../../lib/mock/flow_template";
import { departmentFlows, DeptCode, DeptStep, Dept } from "../../lib/mock/department_flows";

type TabName = "流程模板" | "工程流程" | "專案流程" | "採購流程" | "業務流程";

const TAB_TO_CODE: Record<Exclude<TabName, "流程模板">, DeptCode> = {
    "工程流程": "E",
    "專案流程": "P",
    "採購流程": "S",
    "業務流程": "B"
};

export default function FlowTemplatePage() {
    const [activeTab, setActiveTab] = useState<TabName>("流程模板");
    const [showId, setShowId] = useState(false);

    // --- 流程模板 (主流程) 排序狀態 ---
    const [nodes, setNodes] = useState<FlowNode[]>(flowTemplate);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    // --- 各部門流程 狀態 ---
    const [deptFlows, setDeptFlows] = useState<Record<DeptCode, typeof departmentFlows[DeptCode]>>(departmentFlows);
    const [openDeptDropdown, setOpenDeptDropdown] = useState<string | null>(null);
    const [expandedTierStepId, setExpandedTierStepId] = useState<string | null>(null);
    const [newDeptNodeName, setNewDeptNodeName] = useState("");
    const [newDeptNodeOffset, setNewDeptNodeOffset] = useState<number>(0);
    const [selectedMainNodeToAdd, setSelectedMainNodeToAdd] = useState<string>("");

    // --- 流程模板 Drag & Drop Helpers ---
    const reindex = (list: FlowNode[]) => list.map((n, i) => ({ ...n, seq: i + 1 }));

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
        setDraggingId(id);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, id: string) => {
        e.preventDefault();
        if (draggingId && draggingId !== id) {
            setDragOverId(id);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
        e.preventDefault();
        if (!draggingId || draggingId === targetId) {
            setDraggingId(null);
            setDragOverId(null);
            return;
        }

        const fromIndex = nodes.findIndex(n => n.id === draggingId);
        const toIndex = nodes.findIndex(n => n.id === targetId);

        if (fromIndex !== -1 && toIndex !== -1) {
            const next = [...nodes];
            const [movedItem] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, movedItem);
            setNodes(reindex(next));
        }

        setDraggingId(null);
        setDragOverId(null);
    };

    const handleDragEnd = () => {
        setDraggingId(null);
        setDragOverId(null);
    };

    // --- 部門流程 Helpers ---
    const getAllDeptNodes = () => {
        return Object.values(deptFlows).flatMap(f => f.steps);
    };

    const handleAddNodeToMainFlow = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMainNodeToAdd) return;

        const allNodes = getAllDeptNodes();
        const sourceNode = allNodes.find(n => n.id === selectedMainNodeToAdd);
        if (!sourceNode) return;

        const newNode: FlowNode = {
            id: sourceNode.id,
            seq: nodes.length > 0 ? Math.max(...nodes.map(n => n.seq)) + 1 : 1,
            lane: sourceNode.dept,
            name: sourceNode.name,
            is_core: true, // default to core when added
            depends_on: sourceNode.depends_on,
            offset_days: sourceNode.default_days ?? sourceNode.base_offset_days ?? 0,
            deliverable: ""
        };

        setNodes(prev => reindex([...prev, newNode]));
        setSelectedMainNodeToAdd("");
    };

    const updateDeptNode = (code: DeptCode, index: number, field: keyof DeptStep, value: any) => {
        setDeptFlows(prev => {
            const nextSteps = [...prev[code].steps];
            nextSteps[index] = { ...nextSteps[index], [field]: value };
            return { ...prev, [code]: { ...prev[code], steps: nextSteps } };
        });
    };

    const toggleDeptDependency = (code: DeptCode, index: number, depId: string) => {
        setDeptFlows(prev => {
            const nextSteps = [...prev[code].steps];
            const node = { ...nextSteps[index] };
            if (node.depends_on.includes(depId)) {
                node.depends_on = node.depends_on.filter(id => id !== depId);
            } else {
                node.depends_on = [...node.depends_on, depId];
            }
            nextSteps[index] = node;
            return { ...prev, [code]: { ...prev[code], steps: nextSteps } };
        });
    };

    const applyDefaultTiers = (code: DeptCode, index: number, fallbackDays: number = 0) => {
        updateDeptNode(code, index, 'kw_tiers', [
            { maxKW: 20, days: fallbackDays },
            { maxKW: 100, days: fallbackDays },
            { maxKW: 300, days: fallbackDays },
            { maxKW: 500, days: fallbackDays },
            { maxKW: 999999, days: fallbackDays }
        ]);
        updateDeptNode(code, index, 'default_days', fallbackDays);
    };

    const addTier = (code: DeptCode, stepIndex: number) => {
        setDeptFlows(prev => {
            const nextSteps = [...prev[code].steps];
            const node = { ...nextSteps[stepIndex] };
            const tiers = [...(node.kw_tiers || [])];
            tiers.push({ maxKW: 999999, days: 0 });
            node.kw_tiers = tiers.sort((a, b) => a.maxKW - b.maxKW);
            nextSteps[stepIndex] = node;
            return { ...prev, [code]: { ...prev[code], steps: nextSteps } };
        });
    };

    const updateTier = (code: DeptCode, stepIndex: number, tierIndex: number, field: 'maxKW' | 'days', value: number) => {
        setDeptFlows(prev => {
            const nextSteps = [...prev[code].steps];
            const node = { ...nextSteps[stepIndex] };
            const tiers = [...(node.kw_tiers || [])];
            tiers[tierIndex] = { ...tiers[tierIndex], [field]: value };
            node.kw_tiers = tiers.sort((a, b) => a.maxKW - b.maxKW);
            nextSteps[stepIndex] = node;
            return { ...prev, [code]: { ...prev[code], steps: nextSteps } };
        });
    };

    const removeTier = (code: DeptCode, stepIndex: number, tierIndex: number) => {
        setDeptFlows(prev => {
            const nextSteps = [...prev[code].steps];
            const node = { ...nextSteps[stepIndex] };
            const tiers = [...(node.kw_tiers || [])];
            tiers.splice(tierIndex, 1);
            node.kw_tiers = tiers;
            nextSteps[stepIndex] = node;
            return { ...prev, [code]: { ...prev[code], steps: nextSteps } };
        });
    };

    const deleteDeptNode = (code: DeptCode, index: number) => {
        setDeptFlows(prev => {
            const nextSteps = [...prev[code].steps];
            const deletedId = nextSteps[index].id;
            nextSteps.splice(index, 1);

            const newFlows = { ...prev, [code]: { ...prev[code], steps: nextSteps } };
            // 清除跨部門的所有依賴
            (Object.keys(newFlows) as DeptCode[]).forEach(c => {
                newFlows[c].steps = newFlows[c].steps.map(n => ({
                    ...n,
                    depends_on: n.depends_on.filter(id => id !== deletedId)
                }));
            });
            return newFlows;
        });
    };

    const addDeptNodeInline = (e: React.FormEvent, code: DeptCode) => {
        e.preventDefault();
        if (!newDeptNodeName.trim()) return;

        setDeptFlows(prev => {
            const currentSteps = prev[code].steps;
            const ids = currentSteps.map(n => {
                const match = n.id.match(/\d+/);
                return match ? parseInt(match[0], 10) : 0;
            });
            const maxId = ids.length > 0 ? Math.max(...ids) : 0;
            const nextId = `${code}-${String(maxId + 1).padStart(3, "0")}`;

            const newNode: DeptStep = {
                id: nextId,
                dept: prev[code].dept,
                name: newDeptNodeName.trim(),
                depends_on: [],
                base_offset_days: newDeptNodeOffset,
                kw_tiers: [
                    { maxKW: 20, days: newDeptNodeOffset },
                    { maxKW: 100, days: newDeptNodeOffset },
                    { maxKW: 300, days: newDeptNodeOffset },
                    { maxKW: 500, days: newDeptNodeOffset },
                    { maxKW: 999999, days: newDeptNodeOffset }
                ],
                default_days: newDeptNodeOffset,
                is_core: true
            };

            return {
                ...prev,
                [code]: { ...prev[code], steps: [...currentSteps, newNode] }
            };
        });
        setNewDeptNodeName("");
        setNewDeptNodeOffset(0);
    };

    // --- Render ---
    const renderMasterTemplate = () => {
        const allDeptNodes = getAllDeptNodes();
        const existingIds = new Set(nodes.map(n => n.id));
        const depts = ["工程", "專案", "採購", "業務"] as Dept[];

        return (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden flex flex-col shadow-sm">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                    <form onSubmit={handleAddNodeToMainFlow} className="flex flex-1 items-center gap-4">
                        <select
                            value={selectedMainNodeToAdd}
                            onChange={(e) => setSelectedMainNodeToAdd(e.target.value)}
                            className="flex-1 min-w-[300px] rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="">-- 請選擇要加入流程的部門節點 --</option>
                            {depts.map(deptName => {
                                const deptNodes = allDeptNodes.filter(n => n.dept === deptName);
                                if (deptNodes.length === 0) return null;
                                return (
                                    <optgroup key={deptName} label={deptName}>
                                        {deptNodes.map(n => (
                                            <option key={n.id} value={n.id} disabled={existingIds.has(n.id)}>
                                                {n.dept}｜{n.name}（{n.id}）{existingIds.has(n.id) ? ' - 已在流程中' : ''}
                                            </option>
                                        ))}
                                    </optgroup>
                                );
                            })}
                        </select>
                        <button
                            type="submit"
                            disabled={!selectedMainNodeToAdd}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                            加入流程
                        </button>
                    </form>
                </div>

                <div className="flex-1 overflow-auto rounded-b-lg">
                    <div className="min-w-[600px] flex flex-col">
                        <div className="grid grid-cols-[auto_1fr] bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-400 sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                            <div className="w-16 border-r border-zinc-200 dark:border-zinc-700 flex items-center justify-center py-3">序號</div>
                            <div className="grid grid-cols-[100px_1fr] divide-x divide-zinc-200 dark:divide-zinc-700">
                                <div className="px-4 py-3 flex items-center justify-center">負責部門</div>
                                <div className="px-4 py-3 flex items-center">節點名稱</div>
                            </div>
                        </div>

                        <div className="flex flex-col bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {nodes.map((node) => {
                                const isDragging = draggingId === node.id;
                                const isDragOver = dragOverId === node.id;

                                return (
                                    <div
                                        key={node.id}
                                        className={`group flex items-stretch transition-all duration-200
                                        ${isDragging ? 'opacity-50 scale-[0.99] z-20 shadow-lg' : 'opacity-100'}
                                        ${isDragOver ? 'border-t-2 border-t-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : ''}
                                        hover:bg-zinc-50 dark:hover:bg-zinc-800/30
                                    `}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, node.id)}
                                        onDragOver={handleDragOver}
                                        onDragEnter={(e) => handleDragEnter(e, node.id)}
                                        onDrop={(e) => handleDrop(e, node.id)}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <div className="w-16 bg-zinc-50/80 dark:bg-zinc-800/20 border-r border-zinc-200 dark:border-zinc-800 flex items-center justify-center py-4 text-sm font-mono text-zinc-400 select-none group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/10 transition-colors cursor-grab active:cursor-grabbing">
                                            <div className="flex flex-col items-center gap-1">
                                                <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                                                {node.seq}
                                            </div>
                                        </div>

                                        <div className="flex-1 grid grid-cols-[100px_1fr] divide-x divide-zinc-100 dark:divide-zinc-800/50">
                                            <div className="px-4 py-4 flex items-center justify-center">
                                                <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs rounded-md">
                                                    {node.lane}
                                                </span>
                                            </div>

                                            <div className="px-4 py-4 flex flex-col justify-center">
                                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{node.name}</span>
                                                {node.deliverable && (
                                                    <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate max-w-[400px]" title={node.deliverable}>{node.deliverable}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderDepartmentFlow = (code: DeptCode) => {
        const currentSteps = deptFlows[code].steps;

        // 依照使用者要求：建立全域可選節點清單
        const allDeptSteps = [
            ...deptFlows.E.steps,
            ...deptFlows.P.steps,
            ...deptFlows.S.steps,
            ...deptFlows.B.steps,
        ];

        // 轉成 dropdown options
        const options = allDeptSteps.map(s => ({
            value: s.id,
            label: `${s.dept}｜${s.name}（${s.id}）`,
            dept: s.dept,
            originalStep: s
        }));

        const depts = ["工程", "專案", "採購", "業務"] as Dept[];

        return (
            <div className="space-y-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                        <form onSubmit={(e) => addDeptNodeInline(e, code)} className="flex flex-1 items-center gap-4">
                            <input
                                type="text"
                                placeholder="輸入新節點名稱..."
                                value={newDeptNodeName}
                                onChange={(e) => setNewDeptNodeName(e.target.value)}
                                className="flex-1 min-w-[200px] rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-zinc-500 dark:text-zinc-400">基本工期(天):</span>
                                <input
                                    type="number"
                                    value={newDeptNodeOffset}
                                    onChange={(e) => setNewDeptNodeOffset(parseInt(e.target.value) || 0)}
                                    className="w-20 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 text-center focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!newDeptNodeName.trim()}
                                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                            >
                                新增節點
                            </button>
                        </form>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm min-w-[800px]">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="p-3 font-medium text-zinc-500 dark:text-zinc-400 w-[250px]">任務名稱</th>
                                    {showId && <th className="p-3 font-medium text-zinc-500 dark:text-zinc-400 w-24">ID</th>}
                                    <th className="p-3 font-medium text-zinc-500 dark:text-zinc-400 w-[220px]">跨部門前置依賴</th>
                                    <th className="p-3 font-medium text-zinc-500 dark:text-zinc-400">工期規則摘要</th>
                                    <th className="p-3 font-medium text-zinc-500 dark:text-zinc-400 w-28">類型</th>
                                    <th className="p-3 font-medium text-zinc-500 dark:text-zinc-400 w-20">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {currentSteps.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                                            此部門尚無流程節點
                                        </td>
                                    </tr>
                                ) : currentSteps.map((step, index) => (
                                    <Fragment key={step.id}>
                                        <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="p-3 align-middle">
                                                <input
                                                    value={step.name}
                                                    onChange={(e) => updateDeptNode(code, index, 'name', e.target.value)}
                                                    className="w-full bg-transparent hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 border border-transparent rounded px-2 py-1 text-sm text-zinc-900 dark:text-zinc-100 transition-all font-medium"
                                                />
                                            </td>
                                            {showId && (
                                                <td className="p-3 align-middle text-zinc-600 dark:text-zinc-400 font-mono text-xs">
                                                    {step.id}
                                                </td>
                                            )}
                                            <td className="p-3 align-middle relative">
                                                <button
                                                    onClick={() => setOpenDeptDropdown(openDeptDropdown === step.id ? null : step.id)}
                                                    className="w-full text-left bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 rounded text-sm min-h-[34px] flex flex-wrap gap-1 items-center justify-between hover:border-blue-400 transition-colors"
                                                >
                                                    <div className="flex flex-wrap gap-1 flex-1">
                                                        {step.depends_on.length === 0 ? (
                                                            <span className="text-zinc-400 italic text-xs">無前置</span>
                                                        ) : (
                                                            step.depends_on.map(depId => {
                                                                const opt = options.find(o => o.value === depId);
                                                                return (
                                                                    <span key={depId} className="px-1.5 py-0.5 rounded text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1 group/dep" title={opt ? opt.label : depId}>
                                                                        {showId ? depId : (opt ? opt.originalStep.name.substring(0, 4) + '...' : depId)}
                                                                        <span
                                                                            onClick={(e) => { e.stopPropagation(); toggleDeptDependency(code, index, depId); }}
                                                                            className="opacity-0 group-hover/dep:opacity-100 hover:text-red-500 cursor-pointer p-0.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                        >×</span>
                                                                    </span>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                    <svg className="w-3 h-3 text-zinc-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                </button>
                                                {openDeptDropdown === step.id && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setOpenDeptDropdown(null)} />
                                                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 max-h-[350px] overflow-y-auto w-[350px]">
                                                            <div className="p-2 sticky top-0 bg-white dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700 z-10 flex justify-between items-center">
                                                                <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">選擇跨部門依賴</div>
                                                                <button onClick={() => setOpenDeptDropdown(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                </button>
                                                            </div>
                                                            <div className="p-1">
                                                                {depts.map(deptName => {
                                                                    const deptOptions = options.filter(o => o.dept === deptName && o.value !== step.id);
                                                                    if (deptOptions.length === 0) return null;
                                                                    return (
                                                                        <div key={deptName} className="mb-2 last:mb-0">
                                                                            <div className="px-2 py-1 flex items-center gap-2 sticky top-[33px] bg-white/95 dark:bg-zinc-800/95 backdrop-blur-sm z-10 border-b border-zinc-100/50 dark:border-zinc-700/50">
                                                                                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded">{deptName}</span>
                                                                            </div>
                                                                            <div className="mt-1">
                                                                                {deptOptions.map(opt => (
                                                                                    <label key={opt.value} className="flex items-start px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded cursor-pointer gap-2 transition-colors ml-1">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={step.depends_on.includes(opt.value)}
                                                                                            onChange={() => toggleDeptDependency(code, index, opt.value)}
                                                                                            className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-zinc-300 dark:border-zinc-600 shrink-0"
                                                                                        />
                                                                                        <div className="flex flex-col min-w-0 flex-1 leading-tight mt-[1px]">
                                                                                            <span className="text-sm text-zinc-700 dark:text-zinc-200 leading-snug">{opt.label}</span>
                                                                                        </div>
                                                                                    </label>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </td>
                                            <td className="p-3 align-middle">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-zinc-600 dark:text-zinc-400 text-xs">
                                                        {step.kw_tiers && step.kw_tiers.length > 0
                                                            ? step.kw_tiers.map(t => `${t.maxKW === 999999 ? '>500' : '<=' + t.maxKW}:${t.days}天`).join(', ')
                                                            : '未設定'}
                                                    </span>
                                                    <button
                                                        onClick={() => setExpandedTierStepId(expandedTierStepId === step.id ? null : step.id)}
                                                        className="text-xs text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded dark:bg-blue-900/20 dark:text-blue-400 dark:hover:text-blue-300"
                                                    >
                                                        {expandedTierStepId === step.id ? '隱藏' : '編輯規則'}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-3 align-middle">
                                                <button
                                                    type="button"
                                                    onClick={() => updateDeptNode(code, index, 'is_core', !step.is_core)}
                                                    className={`w-full py-1 text-xs font-medium rounded transition-colors border ${step.is_core
                                                        ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 dark:border-blue-800"
                                                        : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:border-zinc-700"
                                                        }`}
                                                >
                                                    {step.is_core ? "主流程" : "可選"}
                                                </button>
                                            </td>
                                            <td className="p-3 align-middle">
                                                <button
                                                    onClick={() => deleteDeptNode(code, index)}
                                                    className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedTierStepId === step.id && (
                                            <tr className="bg-zinc-50/50 dark:bg-zinc-800/20 border-t-0">
                                                <td colSpan={showId ? 6 : 5} className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                                                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 rounded-md p-4 space-y-4 shadow-sm">
                                                        <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
                                                            <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                                Kwp 級距工期規則 (按上限 Kwp 升冪)
                                                            </h4>
                                                        </div>

                                                        <div className="flex flex-wrap gap-3 px-1">
                                                            {(!step.kw_tiers || step.kw_tiers.length === 0) ? (
                                                                <div className="text-sm text-zinc-400 italic py-2">
                                                                    尚無設定級距，<button onClick={() => applyDefaultTiers(code, index, step.base_offset_days || 0)} className="text-blue-500 hover:underline">點擊套用預設</button>。
                                                                </div>
                                                            ) : (
                                                                step.kw_tiers.map((tier, tIdx) => (
                                                                    <div key={tIdx} className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/80 rounded-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 shadow-sm group/tier hover:border-blue-300 transition-colors">
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-zinc-500 dark:text-zinc-400 font-mono text-xs">
                                                                                {tier.maxKW === 999999 ? '>500' : `<=${tier.maxKW}`} Kwp :
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1">
                                                                            <input
                                                                                type="number"
                                                                                value={tier.days}
                                                                                onChange={(e) => updateTier(code, index, tIdx, 'days', parseInt(e.target.value) || 0)}
                                                                                className="w-12 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-1 py-0.5 text-xs font-semibold text-center focus:ring-1 focus:ring-blue-500 text-blue-700 dark:text-blue-400"
                                                                            />
                                                                            <span className="text-zinc-500 text-xs pl-0.5">天</span>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => removeTier(code, index, tIdx)}
                                                                            className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors ml-1"
                                                                            title="刪除"
                                                                        >
                                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                        </button>
                                                                    </div>
                                                                ))
                                                            )}
                                                            {/* Empty state or loop ended above */}
                                                            {(!step.kw_tiers || step.kw_tiers.length === 0) && (
                                                                <div className="text-sm text-zinc-400 italic py-2">
                                                                    尚無設定級距，<button onClick={() => applyDefaultTiers(code, index, step.base_offset_days || 0)} className="text-blue-500 hover:underline">點擊套用預設</button>。
                                                                </div>
                                                            )}
                                                            <button
                                                                onClick={() => addTier(code, index)}
                                                                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                                            >
                                                                ＋ 新增級距
                                                            </button>
                                                        </div>

                                                        <div className="pt-3 mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-zinc-100 dark:border-zinc-800">
                                                            <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/30 px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700/50">
                                                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">無符合級距時(備援):</span>
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="number"
                                                                        value={step.default_days ?? step.base_offset_days ?? 0}
                                                                        onChange={(e) => updateDeptNode(code, index, 'default_days', parseInt(e.target.value) || 0)}
                                                                        className="w-16 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1 text-sm text-center focus:ring-1 focus:ring-blue-500 font-medium text-zinc-900 dark:text-zinc-100 focus:border-blue-500"
                                                                    />
                                                                    <span className="text-xs text-zinc-500">天</span>
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">提示：上限輸入 999999 代表剩餘極大值。</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    流程設定
                </h1>
                {activeTab !== "流程模板" && (
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showId}
                                onChange={(e) => setShowId(e.target.checked)}
                                className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-600"
                            />
                            顯示節點 ID
                        </label>
                    </div>
                )}
            </div>

            {/* Bookmark Tabs */}
            <div className="flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 mb-6 no-scrollbar">
                {(["流程模板", "工程流程", "專案流程", "採購流程", "業務流程"] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => {
                            setActiveTab(tab);
                            setNewDeptNodeName("");
                            setNewDeptNodeOffset(0);
                        }}
                        className={`whitespace-nowrap py-3 px-5 border-b-2 font-medium text-sm transition-colors ${activeTab === tab
                            ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10 rounded-t-lg"
                            : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:border-zinc-700"
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Render Content based on Active Tab */}
            {activeTab === "流程模板" ? renderMasterTemplate() : renderDepartmentFlow(TAB_TO_CODE[activeTab as Exclude<TabName, "流程模板">])}
        </div>
    );
}
