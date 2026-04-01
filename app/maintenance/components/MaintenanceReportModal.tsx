"use client";

import { useState, useEffect } from "react";
import { MaintenanceReport, InventoryMaster } from "../../../lib/types/database";
import * as actions from "../actions";
import { useProjects } from "../../providers/projects-store";

interface Technician {
    id: string;
    name: string;
    hours: string;
}

interface PartReplacement {
    id: string;
    item_id: string;
    new_model: string;
    old_model: string;
    qty: number;
    new_sn: string;
    old_sn: string;
    source_bucket: string; // '陽光庫存' | 'SE提供'
    fault_reason?: string;
    receive_method?: string;
    received_at?: string;
}

interface TreatmentItem {
    id: string;
    name: string;
    parts: PartReplacement[];
}

interface MaintenanceReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    initialData?: Partial<MaintenanceReport> & { ticket_id?: string };
}

export default function MaintenanceReportModal({ isOpen, onClose, onSave, initialData }: MaintenanceReportModalProps) {
    const { peopleByDept } = useProjects();
    const engineers = peopleByDept["工程"] || [];

    const [projects, setProjects] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [showProjectList, setShowProjectList] = useState(false);

    const [formData, setFormData] = useState<Partial<MaintenanceReport>>({
        case_name: "",
        case_no: "",
        address: "",
        site_contact_name: "",
        site_contact_phone: "",
        repair_item: "優化器",
        repair_notes: "",
        status: "待安排",
        workflow_state: "saved",
        completed_at: new Date().toISOString().split('T')[0],
    });

    const [technicians, setTechnicians] = useState<Technician[]>([
        { id: Date.now().toString(), name: "", hours: "" }
    ]);
    
    // Nested Structure: Treatment Items -> Part Replacements
    const [treatmentItems, setTreatmentItems] = useState<TreatmentItem[]>([
        { id: Date.now().toString(), name: "處理項目 1", parts: [] }
    ]);

    const [inventory, setInventory] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [invData, projData] = await Promise.all([
                    actions.listInventoryMasterAction(),
                    actions.listProjectsMinimalAction()
                ]);
                setInventory(invData);
                setProjects(projData);
            } catch (error) {
                console.error("Failed to load initial data", error);
            }
        };
        if (isOpen) {
            loadInitialData();
        }
    }, [isOpen]);

    useEffect(() => {
        if (initialData && isOpen) {
            setFormData(prev => ({
                ...prev,
                ...initialData,
                status: initialData.status || (initialData as any).repair_status || prev.status || "待安排",
                workflow_state: initialData.workflow_state || "saved",
                completed_at: initialData.completed_at ? initialData.completed_at.split('T')[0] : new Date().toISOString().split('T')[0],
            }));
            
            let metadata: any = {};
            const rawMetadata = (initialData as any).metadata;

            if (rawMetadata) {
                metadata = rawMetadata;
            } else if (initialData.repair_item && initialData.repair_item.startsWith('{')) {
                try {
                    metadata = JSON.parse(initialData.repair_item);
                } catch (e) {
                    console.warn("Failed to parse metadata from repair_item string");
                }
            }

            if (metadata.technicians && Array.isArray(metadata.technicians)) {
                setTechnicians(metadata.technicians);
            }

            if (metadata.treatment_items && Array.isArray(metadata.treatment_items)) {
                // Ensure parts have source_bucket
                const items = metadata.treatment_items.map((t: any) => ({
                    ...t,
                    parts: (t.parts || []).map((p: any) => ({
                        ...p,
                        source_bucket: p.source_bucket || '陽光庫存'
                    }))
                }));
                setTreatmentItems(items);
            } else if (metadata.part_replacements && Array.isArray(metadata.part_replacements)) {
                setTreatmentItems([{
                    id: 'legacy',
                    name: '處理項目',
                    parts: metadata.part_replacements.map((p: any) => ({
                        ...p,
                        source_bucket: p.source_bucket || '陽光庫存'
                    }))
                }]);
            }
        } else if (isOpen) {
            setFormData({
                case_name: "",
                case_no: "",
                address: "",
                site_contact_name: "",
                site_contact_phone: "",
                repair_item: "優化器",
                repair_notes: "",
                status: "待安排",
                workflow_state: "saved",
                completed_at: new Date().toISOString().split('T')[0],
            });
            setTechnicians([{ id: Date.now().toString(), name: "", hours: "" }]);
            setTreatmentItems([{ id: Date.now().toString(), name: "處理項目 1", parts: [] }]);
            setSearchTerm("");
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    // Project Selection
    const filteredProjects = projects.filter(p => 
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.case_no?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectProject = (p: any) => {
        setFormData(prev => ({
            ...prev,
            case_name: p.name,
            case_no: p.case_no,
            address: p.address,
            site_contact_name: p.site_contact_name,
            site_contact_phone: p.site_contact_phone
        }));
        setSearchTerm(p.name);
        setShowProjectList(false);
    };

    // Technicians
    const addTechnician = () => setTechnicians([...technicians, { id: Date.now().toString(), name: "", hours: "" }]);
    const removeTechnician = (id: string) => technicians.length > 1 && setTechnicians(technicians.filter(t => t.id !== id));
    const updateTechnician = (id: string, field: keyof Technician, value: string) => 
        setTechnicians(technicians.map(t => t.id === id ? { ...t, [field]: value } : t));

    // Treatment & Parts
    const addTreatment = () => setTreatmentItems([...treatmentItems, { id: Date.now().toString(), name: `處理項目 ${treatmentItems.length + 1}`, parts: [] }]);
    const removeTreatment = (id: string) => treatmentItems.length > 1 && setTreatmentItems(treatmentItems.filter(t => t.id !== id));
    const updateTreatmentName = (id: string, name: string) => setTreatmentItems(treatmentItems.map(t => t.id === id ? { ...t, name } : t));

    const addPartToTreatment = (treatmentId: string) => {
        setTreatmentItems(treatmentItems.map(t => {
            if (t.id === treatmentId) {
                return {
                    ...t,
                    parts: [...t.parts, { 
                        id: Date.now().toString(), 
                        item_id: "", 
                        new_model: "", 
                        old_model: "", 
                        qty: 1, 
                        new_sn: "", 
                        old_sn: "",
                        source_bucket: '陽光庫存',
                        fault_reason: "",
                        receive_method: "",
                        received_at: ""
                    }]
                };
            }
            return t;
        }));
    };

    const removePartFromTreatment = (treatmentId: string, partId: string) => {
        setTreatmentItems(treatmentItems.map(t => {
            if (t.id === treatmentId) {
                return { ...t, parts: t.parts.filter(p => p.id !== partId) };
            }
            return t;
        }));
    };

    const updatePartInTreatment = (treatmentId: string, partId: string, field: keyof PartReplacement, value: any) => {
        setTreatmentItems(treatmentItems.map(t => {
            if (t.id === treatmentId) {
                return {
                    ...t,
                    parts: t.parts.map(p => {
                        if (p.id === partId) {
                            if (field === 'new_model') {
                                const match = inventory.find(i => i.name === value);
                                return { ...p, [field]: value, item_id: match?.id || p.item_id };
                            }
                            return { ...p, [field]: value };
                        }
                        return p;
                    })
                };
            }
            return t;
        }));
    };

    const handleSave = async (submitForRec = false) => {
        if (!formData.case_name) {
            alert("請選取案場");
            return;
        }

        if (submitForRec && formData.status !== '已完成') {
            alert("案件狀態必須為「已完成」才能送核對");
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...formData,
                repair_staff: technicians.map(t => t.name).filter(Boolean).join(", "),
                metadata: {
                    technicians,
                    treatment_items: treatmentItems
                }
            };

            let savedReport;
            if (formData.id) {
                if (submitForRec) {
                    savedReport = await actions.submitForReconciliationAction(formData.id, payload as any);
                } else {
                    savedReport = await actions.updateMaintenanceReportAction(formData.id, payload as any);
                }
            } else {
                savedReport = await actions.createMaintenanceReportAction(payload as any);
                if (submitForRec) {
                    await actions.submitForReconciliationAction(savedReport.id);
                }
            }

            onClose();
            onSave();
        } catch (error: any) {
            alert(`操作失敗：\n${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            
            <div className="relative w-full max-w-5xl rounded-[2.5rem] bg-white shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[95vh] overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900 sticky top-0 z-10">
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                                {formData.id ? "編輯維修紀錄" : "新增維修紀錄"}
                            </h3>
                            {formData.workflow_state === 'returned' && (
                                <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-[10px] font-black px-3 py-1 rounded-full uppercase">被退回</span>
                            )}
                        </div>
                        <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-0.5">Maintenance Report</p>
                    </div>
                    <button onClick={onClose} className="p-2.5 rounded-2xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
                    
                    {formData.workflow_state === 'returned' && (
                        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-100 dark:border-red-900/30 p-6 rounded-[2rem]">
                            <h5 className="text-red-600 dark:text-red-400 text-xs font-black uppercase mb-2">退回原因</h5>
                            <p className="text-sm font-bold text-red-800 dark:text-red-300">{(formData as any).returned_reason || "無說明"}</p>
                        </div>
                    )}

                    {/* 1. 基本資料 */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-50">
                            <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                            <h4 className="text-lg font-black uppercase tracking-tight">基本資料</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-zinc-50/50 dark:bg-zinc-800/20 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800/50">
                            <div className="md:col-span-2 relative">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-1.5 block">案場選取 *</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        placeholder="快速搜尋案場名稱或案號..."
                                        value={searchTerm || formData.case_name || ""}
                                        onChange={e => { setSearchTerm(e.target.value); setShowProjectList(true); }}
                                        onFocus={() => setShowProjectList(true)}
                                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-3.5 text-sm font-black focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm group-hover:shadow-md"
                                    />
                                    {showProjectList && filteredProjects.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto border-t-4 border-t-blue-500">
                                            {filteredProjects.map(p => (
                                                <button 
                                                    key={p.id}
                                                    onClick={() => selectProject(p)}
                                                    className="w-full text-left px-5 py-3.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-zinc-50 dark:border-zinc-800 last:border-0"
                                                >
                                                    <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">{p.name}</div>
                                                    <div className="text-[10px] text-zinc-400 font-bold mt-0.5">{p.case_no} | {p.address}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-1.5 block">案號</label>
                                <input readOnly value={formData.case_no || ""} className="w-full bg-zinc-100/50 dark:bg-zinc-800/30 border-transparent rounded-2xl px-5 py-3.5 text-sm font-bold text-zinc-500" />
                            </div>
                            <div className="md:col-span-3 pb-2">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-1.5 block">案場地址</label>
                                <input readOnly value={formData.address || ""} className="w-full bg-zinc-100/50 dark:bg-zinc-800/30 border-transparent rounded-2xl px-5 py-3.5 text-sm font-bold text-zinc-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-1.5 block" title="Site Contact">聯絡人</label>
                                <input readOnly value={formData.site_contact_name || ""} className="w-full bg-zinc-100/50 dark:bg-zinc-800/30 border-transparent rounded-2xl px-5 py-3.5 text-sm font-bold text-zinc-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-1.5 block">聯絡電話</label>
                                <input readOnly value={formData.site_contact_phone || ""} className="w-full bg-zinc-100/50 dark:bg-zinc-800/30 border-transparent rounded-2xl px-5 py-3.5 text-sm font-bold text-zinc-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-1.5 block">案件狀態</label>
                                <select 
                                    value={formData.status || "待安排"}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-none rounded-2xl px-5 py-3.5 text-sm font-black focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none cursor-pointer"
                                >
                                    <option value="待安排">待安排</option>
                                    <option value="已安排">已安排</option>
                                    <option value="處理中">處理中</option>
                                    <option value="已完成">已完成</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* 2. 維修處理資訊 */}
                    <section className="space-y-8">
                        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-50">
                            <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                            <h4 className="text-lg font-black uppercase tracking-tight">維修處理資訊</h4>
                        </div>
                        
                        <div className="space-y-10">
                            {/* Staff Selection */}
                            <div className="bg-zinc-50/30 dark:bg-zinc-800/10 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800/50">
                                <div className="flex justify-between items-center mb-6">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 text-blue-600">維修人員名單 (快選)</label>
                                    <button onClick={addTechnician} className="text-[10px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-xl uppercase tracking-tighter hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
                                        + 新增工程師
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {technicians.map((tech) => (
                                        <div key={tech.id} className="flex gap-3 items-center bg-white dark:bg-zinc-800 p-2 rounded-2xl border border-zinc-100 dark:border-zinc-700 shadow-sm transition-all hover:shadow-md">
                                            <select
                                                value={tech.name}
                                                onChange={e => updateTechnician(tech.id, 'name', e.target.value)}
                                                className="flex-1 bg-transparent border-none px-3 py-1.5 text-sm font-black focus:ring-0 outline-none appearance-none"
                                            >
                                                <option value="">選擇人員...</option>
                                                {engineers.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                                            </select>
                                            <input
                                                type="text"
                                                placeholder="用時 (2h)"
                                                value={tech.hours}
                                                onChange={e => updateTechnician(tech.id, 'hours', e.target.value)}
                                                className="w-20 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl px-2 py-1.5 text-xs text-center font-bold focus:ring-2 focus:ring-blue-500/20 transition-all"
                                            />
                                            {technicians.length > 1 && (
                                                <button onClick={() => removeTechnician(tech.id)} className="p-1.5 text-zinc-300 hover:text-red-500 transition-colors">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* TREATMENT NESTED STRUCTURE */}
                            <div className="space-y-8">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">處理項目與用料詳情 (多項目)</label>
                                    <button onClick={addTreatment} className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-all uppercase tracking-widest">
                                        + 新增處理項目
                                    </button>
                                </div>
                                
                                {treatmentItems.map((treatment, tIndex) => (
                                    <div key={treatment.id} className="relative p-8 bg-zinc-50/50 dark:bg-white/[0.02] border-2 border-zinc-100 dark:border-zinc-800 rounded-[3rem] space-y-6 animate-in slide-in-from-left-4 duration-300 group">
                                        <div className="flex items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                                            <span className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-black text-xs">{tIndex + 1}</span>
                                            <input 
                                                list="treatment-suggestions"
                                                value={treatment.name}
                                                onChange={e => updateTreatmentName(treatment.id, e.target.value)}
                                                placeholder="例如：主機風扇更換、直流盤巡檢..."
                                                className="flex-1 bg-transparent border-none text-lg font-black text-zinc-900 dark:text-zinc-50 focus:ring-0 placeholder:text-zinc-300"
                                            />
                                            <datalist id="treatment-suggestions">
                                                {Array.from(new Set(inventory.map(i => i.category))).map(cat => (
                                                    <option key={cat} value={cat} />
                                                ))}
                                            </datalist>
                                            {treatmentItems.length > 1 && (
                                                <button onClick={() => removeTreatment(treatment.id)} className="text-zinc-300 hover:text-red-500 p-2 transition-colors">
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between pl-4">
                                                <div className="text-[11px] font-black text-zinc-400 flex items-center gap-2 uppercase tracking-wide">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                                    對應更換料件 ({treatment.parts.length})
                                                </div>
                                                <button onClick={() => addPartToTreatment(treatment.id)} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline">
                                                    + 新增料件
                                                </button>
                                            </div>

                                            {treatment.parts.map((part, pIndex) => (
                                                <div key={part.id} className="ml-4 p-6 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm relative space-y-4 hover:border-blue-200 transition-all group/part">
                                                    <button onClick={() => removePartFromTreatment(treatment.id, part.id)} className="absolute -top-2 -right-2 w-7 h-7 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full flex items-center justify-center text-zinc-300 hover:text-red-500 shadow-sm transition-all group-hover/part:scale-110">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                                                        <div className="md:col-span-2 space-y-1.5">
                                                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">新型號</label>
                                                            <input
                                                                list={`inv-${part.id}`}
                                                                placeholder="搜尋庫存..."
                                                                value={part.new_model}
                                                                onChange={e => updatePartInTreatment(treatment.id, part.id, 'new_model', e.target.value)}
                                                                className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 text-sm font-black focus:ring-2 focus:ring-blue-500/20"
                                                            />
                                                            <datalist id={`inv-${part.id}`}>
                                                                {inventory.map(item => (
                                                                    <option key={item.id} value={item.name}>{item.category} | {item.name}</option>
                                                                ))}
                                                            </datalist>
                                                        </div>
                                                        <div className="md:col-span-2 space-y-1.5">
                                                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">料件來源 *</label>
                                                            <select
                                                                value={part.source_bucket}
                                                                onChange={e => updatePartInTreatment(treatment.id, part.id, 'source_bucket', e.target.value)}
                                                                className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-none rounded-xl px-4 py-2.5 text-sm font-black focus:ring-2 focus:ring-blue-500/20"
                                                            >
                                                                <option value="陽光庫存">陽光庫存</option>
                                                                <option value="SE提供">SE提供</option>
                                                            </select>
                                                        </div>
                                                        <div className="md:col-span-1 space-y-1.5">
                                                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">舊型號</label>
                                                            <input
                                                                type="text"
                                                                placeholder="舊件"
                                                                value={part.old_model}
                                                                onChange={e => updatePartInTreatment(treatment.id, part.id, 'old_model', e.target.value)}
                                                                className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 text-sm font-black focus:ring-2 focus:ring-blue-500/20"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-1 space-y-1.5 text-center">
                                                            <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">數量</label>
                                                            <input
                                                                type="number"
                                                                value={part.qty}
                                                                onChange={e => updatePartInTreatment(treatment.id, part.id, 'qty', parseInt(e.target.value) || 0)}
                                                                className="w-full text-center bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-2 py-2.5 text-sm font-black focus:ring-2 focus:ring-blue-500/20"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4 pb-1">
                                                        <div className="space-y-1">
                                                            <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">新序號 (S/N)</label>
                                                            <input 
                                                                value={part.new_sn}
                                                                onChange={e => updatePartInTreatment(treatment.id, part.id, 'new_sn', e.target.value)}
                                                                placeholder="掃描序號"
                                                                className="w-full bg-transparent border-b border-zinc-100 p-0 text-xs font-bold focus:ring-0 focus:border-blue-400 outline-none placeholder:opacity-40"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">舊序號 (S/N)</label>
                                                            <input 
                                                                value={part.old_sn}
                                                                onChange={e => updatePartInTreatment(treatment.id, part.id, 'old_sn', e.target.value)}
                                                                placeholder="舊件序號"
                                                                className="w-full bg-transparent border-b border-zinc-100 p-0 text-xs font-bold focus:ring-0 focus:border-blue-400 outline-none placeholder:opacity-40"
                                                            />
                                                        </div>
                                                    </div>

                                                    {part.source_bucket === 'SE提供' && (
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-zinc-50 dark:border-zinc-800/50">
                                                            <div className="space-y-1">
                                                                <label className="text-[8px] font-black text-amber-600 uppercase tracking-widest ml-1">故障原因</label>
                                                                <input 
                                                                    value={part.fault_reason}
                                                                    onChange={e => updatePartInTreatment(treatment.id, part.id, 'fault_reason', e.target.value)}
                                                                    placeholder="例如：通訊失敗"
                                                                    className="w-full bg-transparent border-b border-amber-100 p-0 text-xs font-bold focus:ring-0 focus:border-amber-400 outline-none"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[8px] font-black text-amber-600 uppercase tracking-widest ml-1">收貨方式</label>
                                                                <input 
                                                                    value={part.receive_method}
                                                                    onChange={e => updatePartInTreatment(treatment.id, part.id, 'receive_method', e.target.value)}
                                                                    placeholder="例如：大榮貨運"
                                                                    className="w-full bg-transparent border-b border-amber-100 p-0 text-xs font-bold focus:ring-0 focus:border-amber-400 outline-none"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[8px] font-black text-amber-600 uppercase tracking-widest ml-1">收取物料時間</label>
                                                                <input 
                                                                    type="date"
                                                                    value={part.received_at ? part.received_at.split('T')[0] : ""}
                                                                    onChange={e => updatePartInTreatment(treatment.id, part.id, 'received_at', e.target.value)}
                                                                    className="w-full bg-transparent border-b border-amber-100 p-0 text-xs font-bold focus:ring-0 focus:border-amber-400 outline-none"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {treatment.parts.length === 0 && (
                                                <div className="ml-4 py-6 border-2 border-dashed border-zinc-100 dark:border-zinc-800/50 rounded-[2rem] text-center text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                                                    無更換零件
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* 3. 維修說明 */}
                    <section className="space-y-6 pb-4">
                        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-50">
                            <div className="w-1.5 h-6 bg-zinc-900 dark:bg-zinc-100 rounded-full"></div>
                            <h4 className="text-lg font-black uppercase tracking-tight">維修說明與詳細紀錄</h4>
                        </div>
                        <textarea
                            placeholder="記錄具體維修細節、現場狀況或後續建議..."
                            value={formData.repair_notes || ""}
                            onChange={e => setFormData({ ...formData, repair_notes: e.target.value })}
                            rows={5}
                            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] px-10 py-8 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none shadow-inner resize-none transition-all placeholder:text-zinc-300"
                        />
                    </section>

                </div>

                {/* Footer Buttons */}
                <div className="px-10 py-8 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-between items-center sticky bottom-0 z-10 shadow-2xl">
                    <button 
                        onClick={() => handleSave(true)}
                        disabled={isSaving || formData.status !== '已完成'}
                        className="px-10 py-4.5 bg-emerald-600 text-white rounded-[1.8rem] text-sm font-black shadow-xl shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale hover:bg-emerald-700 flex items-center gap-2 group tracking-widest"
                    >
                        <svg className="w-5 h-5 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        完成並送核對
                    </button>
                    
                    <div className="flex gap-4">
                        <button onClick={onClose} className="text-sm font-black text-zinc-400 hover:text-red-500 transition-colors px-6">
                            取消
                        </button>
                        <button
                            onClick={() => handleSave(false)}
                            disabled={isSaving}
                            className="px-12 py-4.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-[1.8rem] text-sm font-black shadow-2xl transition-all active:scale-95 disabled:opacity-50 hover:bg-zinc-800 dark:hover:bg-zinc-200 tracking-widest"
                        >
                            {isSaving ? "處理中..." : "儲存 (草稿)"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
