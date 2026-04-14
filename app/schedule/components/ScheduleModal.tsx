"use client";

import { useState, useEffect } from "react";
import { DailySchedule } from "../../../lib/types/database";
import { useProjects } from "../../providers/projects-store";
import * as actions from "../actions";
import type { ScheduleCaseSearchItem } from "../actions";

interface ScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<DailySchedule>, action: 'save' | 'accept' | 'reject') => void;
    initialData?: DailySchedule;
    initialDate?: string;
    mode?: 'default' | 'application' | 'todo_promotion';
}

const formatLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function ScheduleModal({ isOpen, onClose, onSave, initialData, initialDate, mode = 'default' }: ScheduleModalProps) {
    const { peopleByDept, projects } = useProjects();
    const [loading, setLoading] = useState(false);
    const [caseSearchOptions, setCaseSearchOptions] = useState<ScheduleCaseSearchItem[]>([]);

    const [caseName, setCaseName] = useState(initialData?.case_name || "");
    const [scheduleDate, setScheduleDate] = useState<string>("");
    const defaultStartTime = mode === 'application' ? "" : "08:00";
    const defaultEndTime = mode === 'application' ? "" : "17:00";
    const [startTime, setStartTime] = useState(initialData?.id ? (initialData?.start_time?.slice(0, 5) || "") : defaultStartTime);
    const [endTime, setEndTime] = useState(initialData?.id ? (initialData?.end_time?.slice(0, 5) || "") : defaultEndTime);
    const [engineerId, setEngineerId] = useState(initialData?.engineer_id || "");
    const [assigneeIds, setAssigneeIds] = useState<string[]>(initialData?.assignee_ids || []);
    const [projectId, setProjectId] = useState(initialData?.project_id || "");
    const [projectSearch, setProjectSearch] = useState("");
    const [description, setDescription] = useState(initialData?.description || "");
    const [status, setStatus] = useState(initialData?.status || (mode === 'application' ? 'application' : "pending_claim"));
    const [caseType, setCaseType] = useState(initialData?.case_type || "進場");
    const [address, setAddress] = useState(initialData?.address || "");
    const [isEndTimeUserModified, setIsEndTimeUserModified] = useState(false);

    const [workTypes, setWorkTypes] = useState<string[]>(["掛表", "現勘", "進場", "停電", "建置", "電檢", "驗收", "維修", "清洗", "開會", "內勤", "其他", "休假"]);

    const allStaff = Object.values(peopleByDept).flat();
    const engineers = peopleByDept["工程"] || [];

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const types = await actions.getSettingAction<string[]>("schedule_work_types");
                if (types) setWorkTypes(types);
            } catch (error: any) {
                console.error("Failed to load work types setting:", error);
            }
        };
        loadSettings();
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadCaseSearchOptions = async () => {
            try {
                const items = await actions.listScheduleCaseSearchAction();
                if (!cancelled) setCaseSearchOptions(items);
            } catch (error) {
                console.error("Failed to load schedule case search options:", error);
            }
        };

        loadCaseSearchOptions();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            const dateToSet = (initialData?.schedule_date && initialData.schedule_date !== '1970-01-01') 
                ? initialData.schedule_date 
                : (initialDate || formatLocal(new Date()));
            setScheduleDate(dateToSet);
            const defStartTime = mode === 'application' ? "" : "08:00";
            const defEndTime = mode === 'application' ? "" : "17:00";
            setStartTime(initialData?.id ? (initialData?.start_time?.slice(0, 5) || "") : defStartTime);
            setEndTime(initialData?.id ? (initialData?.end_time?.slice(0, 5) || "") : defEndTime);
            setEngineerId(initialData?.engineer_id || "");
            setAssigneeIds(initialData?.assignee_ids || []);
            setProjectId(initialData?.project_id || "");
            const linkedProject = projects.find(p => p.project_id === (initialData?.project_id || ""));
            setProjectSearch(linkedProject?.project_name || (initialData?.case_name && !initialData.project_id ? initialData.case_name : ""));
            setDescription(initialData?.description || "");
            setStatus(initialData?.status || (mode === 'application' ? 'application' : "pending_claim"));
            setCaseType(initialData?.case_type || "進場");
            setAddress(initialData?.address || "");
            setIsEndTimeUserModified(false);
        }
    }, [isOpen, initialData, initialDate, projects, mode]);

    if (!isOpen) return null;

    const generateTimeOptions = (isOther: boolean) => {
        const options = [];
        const start = isOther ? 0 : 8;
        const end = isOther ? 24 : 17;
        for (let h = start; h <= end; h++) {
            const hh = String(h).padStart(2, '0');
            options.push(`${hh}:00`);
            if (h < end) options.push(`${hh}:30`);
        }
        if (!isOther && options[options.length - 1] !== "17:00") options.push("17:00");
        return options;
    };

    const isOtherType = caseType === "其他";
    const timeOptions = generateTimeOptions(isOtherType);
    const normalizedSearch = projectSearch.toLowerCase().trim();
    const filteredProjects = normalizedSearch
        ? caseSearchOptions.filter(item =>
            [
                item.case_name,
                item.case_no,
                item.address,
                item.region,
                item.site_type,
                item.source
            ].some(value => (value || "").toLowerCase().includes(normalizedSearch))
        )
        : [];

    const findExactCaseOption = (value: string) => {
        const normalized = value.toLowerCase().trim();
        if (!normalized) return null;
        return caseSearchOptions.find(item =>
            item.case_name.toLowerCase().trim() === normalized ||
            (item.case_no || "").toLowerCase().trim() === normalized
        ) || null;
    };

    const resolveProjectId = (item: ScheduleCaseSearchItem) => {
        const matchedProject = projects.find(p =>
            (item.project_id && p.project_id === item.project_id) ||
            (item.case_no && p.case_no === item.case_no) ||
            p.project_name === item.case_name
        );
        return matchedProject?.project_id || "";
    };

    const resolveProjectAddress = (item: ScheduleCaseSearchItem) => {
        if (item.address) return item.address;
        const matchedProject = projects.find(p =>
            (item.project_id && p.project_id === item.project_id) ||
            (item.case_no && p.case_no === item.case_no) ||
            p.project_name === item.case_name
        );
        return matchedProject?.address || "";
    };

    const handleCaseInputChange = (val: string) => {
        setProjectSearch(val);
        setCaseName(val);

        const matched = findExactCaseOption(val);
        if (matched) {
            setProjectId(resolveProjectId(matched));
            const resolvedAddress = resolveProjectAddress(matched);
            if (resolvedAddress) setAddress(resolvedAddress);
            return;
        }

        const matchedProject = projects.find(p =>
            p.project_name === val ||
            (p.case_no || "").toLowerCase() === val.toLowerCase().trim()
        );
        setProjectId(matchedProject?.project_id || "");
        if (matchedProject?.address) setAddress(matchedProject.address);
    };

    const handleCaseOptionSelect = (item: ScheduleCaseSearchItem) => {
        setProjectId(resolveProjectId(item));
        setProjectSearch(item.case_name || "");
        setCaseName(item.case_name || "");
        const resolvedAddress = resolveProjectAddress(item);
        if (resolvedAddress) setAddress(resolvedAddress);
    };

    const shouldShowCaseOptions = normalizedSearch.length > 0 && filteredProjects.length > 0;

    const formData: Partial<DailySchedule> = {
        case_name: caseName || "",
        schedule_date: scheduleDate,
        start_time: startTime ? `${startTime}:00` : null,
        end_time: endTime ? `${endTime}:00` : null,
        engineer_id: engineerId || null,
        assignee_ids: assigneeIds || [],
        project_id: projectId || null,
        case_type: caseType,
        address: address || null,
        description: description || null,
        status: status
    };

    const handleConfirm = async () => {
        if (mode === 'application' || mode === 'todo_promotion') {
            await onSave(formData, 'save');
            onClose();
            return;
        }
        setLoading(true);
        try {
            let res: any;
            if (initialData?.id) {
                res = await actions.updateScheduleAction(initialData.id, formData);
            } else {
                res = await actions.createScheduleAction(formData as any);
            }
            if (res?.googleSync && !res.googleSync.success) {
                alert(`⚠️ 排程已儲存，但 Google 日曆同步失敗：\n${res.googleSync.error || '原因未知'}`);
            }
            onSave(formData, 'save');
            onClose();
        } catch (error: any) {
            alert(`儲存失敗！\n\n${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!initialData?.id) return;
        setLoading(true);
        try {
            await actions.deleteScheduleAction(initialData.id);
            await onSave({}, 'reject');
            onClose();
        } catch (error: any) {
            alert("刪除失敗");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                        <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
                        {mode === 'application' ? (initialData?.id ? '審核任務申請' : '新增任務申請') : mode === 'todo_promotion' ? '將待辦加入排程' : initialData?.id ? '編輯排程' : '新增排程'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh] no-scrollbar">
                    {/* Row 1: Case Name & Item (項目) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">案件名稱</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={projectSearch || caseName}
                                    onChange={(e) => handleCaseInputChange(e.target.value)}
                                    placeholder="搜尋案場或手動輸入..."
                                    className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                                />
                                {shouldShowCaseOptions && (
                                    <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-lg bg-white shadow-xl ring-1 ring-black/5 dark:bg-zinc-800 no-scrollbar">
                                        {filteredProjects.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => handleCaseOptionSelect(p)}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium"
                                            >
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <span>{p.case_name}</span>
                                                    <span className="text-[10px] font-mono text-zinc-400">
                                                        {[p.case_no, p.region, p.site_type].filter(Boolean).join(" · ")}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">項目</label>
                            <select
                                value={caseType}
                                onChange={(e) => setCaseType(e.target.value)}
                                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            >
                                {workTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Row 2: Address (位址) */}
                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">位址</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="請輸入施作位址"
                            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                    </div>

                    {/* Row 3: Description (備註) - Now below Address */}
                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">備註</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="請輸入詳細說明..."
                            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 resize-none font-bold"
                        />
                    </div>

                    {/* Row 4: Main Engineer & Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">主工程</label>
                            <select
                                value={engineerId}
                                onChange={(e) => setEngineerId(e.target.value)}
                                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            >
                                <option value="">待領取/未定</option>
                                {engineers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">日期</label>
                            <input
                                type="date"
                                value={scheduleDate}
                                onChange={(e) => setScheduleDate(e.target.value)}
                                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                        </div>
                    </div>

                    {/* Row 5: Time Selection & Helpers */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">開始</label>
                                <select
                                    value={startTime}
                                    onChange={(e) => {
                                        const newStart = e.target.value;
                                        setStartTime(newStart);
                                        if (newStart && !isEndTimeUserModified && (!endTime || endTime === "")) {
                                            const [h, m] = newStart.split(':').map(Number);
                                            const endH = (h + 2) % 24;
                                            setEndTime(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                                        }
                                    }}
                                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                                >
                                    <option value="">未定</option>
                                    {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">結束</label>
                                <select
                                    value={endTime}
                                    onChange={(e) => { setEndTime(e.target.value); setIsEndTimeUserModified(true); }}
                                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                                >
                                    <option value="">未定</option>
                                    {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">協助人員</label>
                            <select
                                onChange={(e) => {
                                    const id = e.target.value;
                                    if (id && !assigneeIds.includes(id)) setAssigneeIds([...assigneeIds, id]);
                                    e.target.value = "";
                                }}
                                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            >
                                <option value="">加入協助人員...</option>
                                {engineers.filter(s => !assigneeIds.includes(s.id) && s.id !== engineerId).map(staff => (
                                    <option key={staff.id} value={staff.id}>{staff.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Helper Chips */}
                    {assigneeIds.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {assigneeIds.map(id => {
                                const staff = allStaff.find(s => s.id === id);
                                return (
                                    <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[10px] font-black rounded-lg border border-zinc-200 dark:border-zinc-700">
                                        {staff?.name || "未知"}
                                        <button onClick={() => setAssigneeIds(assigneeIds.filter(aid => aid !== id))} className="text-zinc-400 hover:text-red-500">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
                    <div>
                        {initialData?.id && (mode === 'default') && (
                            <button onDoubleClick={handleDelete} className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/40" title="連按兩下刪除"> 刪除排程 </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"> 取消 </button>
                        <button
                            onClick={handleConfirm}
                            className="px-8 py-2 bg-blue-600 text-white text-sm font-black rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                        >
                            {mode === 'application' ? '送出申請' : '儲存變更'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
