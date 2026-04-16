"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { DailySchedule, TodoItem } from "../../../lib/types/database";
import { useProjects } from "../../providers/projects-store";
import ScheduleModal from "./ScheduleModal";
import * as actions from "../actions";
import { formatProjectName } from "../../../lib/utils/formatters";

interface WeeklyViewProps {
    schedules: DailySchedule[];
    refreshSchedules: () => void;
}

const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const extractRegion = (address?: string | null, caseName?: string | null) => {
    if (address) {
        const match = address.match(/(?:市|縣)(.+?)(?:區|市|鎮|鄉)/);
        if (match) return match[1];
    }
    if (caseName) {
        const stripped = caseName.replace(/^(新北|台北|桃園|台中|台南|高雄|新北市|台北市|桃園市|台中市|台南市|高雄市)/, '');
        const match = stripped.match(/^([^-\s\(\)（）]+)/);
        if (match) return match[1].replace(/區$/, '');
    }
    return null;
};

export default function WeeklyView({ schedules, refreshSchedules }: WeeklyViewProps) {
    const { peopleByDept, projects } = useProjects();
    const [activeTab, setActiveTab] = useState<"week" | "month" | "tracking">("week");
    const [currentDate, setCurrentDate] = useState(new Date());
    const [newTaskTitle, setNewTaskTitle] = useState("");

    const [leftHeights, setLeftHeights] = useState<[number, number, number]>([250, 250, 250]);
    const [isMounted, setIsMounted] = useState(false);
    const [todayStr, setTodayStr] = useState("");

    useEffect(() => {
        setIsMounted(true);
        setTodayStr(formatLocalDate(new Date()));
        const saved = localStorage.getItem('schedule_left_heights');
        if (saved) {
            try {
                setLeftHeights(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse left heights", e);
            }
        }
    }, []);

    useEffect(() => {
        if (isMounted) {
            localStorage.setItem('schedule_left_heights', JSON.stringify(leftHeights));
        }
    }, [leftHeights, isMounted]);

    const isDraggingRef = useRef<number | null>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDraggingRef.current === null) return;
            const index = isDraggingRef.current;
            e.preventDefault();
            setLeftHeights(prev => {
                const newHeights = [...prev] as [number, number, number];
                newHeights[index] += e.movementY;
                newHeights[index + 1] -= e.movementY;
                if (newHeights[index] < 120) {
                    newHeights[index + 1] -= (120 - newHeights[index]);
                    newHeights[index] = 120;
                }
                if (newHeights[index + 1] < 120) {
                    newHeights[index] -= (120 - newHeights[index + 1]);
                    newHeights[index + 1] = 120;
                }
                return newHeights;
            });
        };
        const handleMouseUp = () => {
            isDraggingRef.current = null;
            document.body.classList.remove("cursor-row-resize", "select-none");
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    const [todos, setTodos] = useState<TodoItem[]>([]);
    const [newTodoTitle, setNewTodoTitle] = useState("");
    const [newPersonalTodoTitle, setNewPersonalTodoTitle] = useState("");
    const [isRefreshingTodos, setIsRefreshingTodos] = useState(false);

    const teamTodosList = todos.filter(t => !t.title.startsWith('[PERSONAL]')).map(t => ({
        ...t,
        displayTitle: t.title
    }));
    const personalTodosList = todos.filter(t => t.title.startsWith('[PERSONAL]')).map(t => ({
        ...t,
        displayTitle: t.title.replace('[PERSONAL] ', '')
    }));

    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        initialData?: DailySchedule;
        initialDate?: string;
        mode?: 'default' | 'application' | 'todo_promotion';
        todoId?: string;
        appId?: string;
        appIndex?: number;
    }>({ isOpen: false });

    const [deletedTodos, setDeletedTodos] = useState<TodoItem[]>([]);
    const [externalApps, setExternalApps] = useState<DailySchedule[]>([]);
    const personalInputRef = useRef<HTMLInputElement>(null);

    const weekStart = useMemo(() => {
        const d = new Date(currentDate);
        const day = d.getDay();
        const diff = d.getDate() - (day === 0 ? 6 : day - 1);
        return new Date(new Date(d.setDate(diff)).setHours(0, 0, 0, 0));
    }, [currentDate]);

    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            days.push(d);
        }
        return days;
    }, [weekStart]);

    const monthDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];
        const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        for (let i = startPadding; i > 0; i--) {
            const d = new Date(year, month, 1 - i);
            days.push(d);
        }
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }
        const totalCells = days.length > 35 ? 42 : 35;
        const endPadding = totalCells - days.length;
        for (let i = 1; i <= endPadding; i++) {
            const d = new Date(year, month + 1, i);
            days.push(d);
        }
        return days;
    }, [currentDate]);

    const fetchTodos = async () => {
        setIsRefreshingTodos(true);
        try {
            const data = await actions.listTodosAction();
            setTodos(data);
        } catch (e: any) {
            console.error("Failed to fetch todos", e);
        } finally {
            setIsRefreshingTodos(false);
        }
    };

    const fetchExternalApps = async () => {
        try {
            const data = await actions.listApplicationsAction();
            setExternalApps(data || []);
        } catch (e: any) {
            console.error("Failed to fetch applications", e);
        }
    };

    useEffect(() => {
        fetchTodos();
        fetchExternalApps();
    }, []);

    const navigate = (amount: number) => {
        const d = new Date(currentDate);
        if (activeTab === "week") {
            d.setDate(d.getDate() + (amount * 7));
        } else {
            d.setMonth(d.getMonth() + amount);
        }
        setCurrentDate(d);
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const allStaff = Object.values(peopleByDept).flat();

    // Normalize schedules: filter out google readonly duplicates if internal mapped exists
    const normalizedSchedules = useMemo(() => {
        const internalGoogleIds = new Set(
            schedules
                .filter(s => s.source !== 'google_readonly' && s.google_event_id)
                .map(s => s.google_event_id)
        );

        return schedules.filter(s => {
            if (s.source === 'google_readonly' && s.google_event_id && internalGoogleIds.has(s.google_event_id)) {
                return false;
            }
            return true;
        });
    }, [schedules]);

    const allInternalGoogleEventIds = useMemo(() => {
        return new Set(
            normalizedSchedules
                .filter(s => s.source !== 'google_readonly' && s.google_event_id)
                .map(s => s.google_event_id)
        );
    }, [normalizedSchedules]);

    const getSchedulesForDay = (date: Date) => {
        const dateStr = formatLocalDate(date);
        const daySchedules = normalizedSchedules
            .filter(s => s.schedule_date === dateStr && s.status !== 'application' && s.case_type !== '任務申請');
        return daySchedules
            .sort((a, b) => {
                const timeA = a.start_time || "99:99";
                const timeB = b.start_time || "99:99";
                return timeA.localeCompare(timeB);
            });
    };

    const openScheduleModal = (schedule: DailySchedule) => {
        const actual = normalizedSchedules.find((s) => s.id === schedule.id) || schedule;
        setModalConfig({
            isOpen: true,
            initialData: actual,
            mode: actual.status === 'application' ? 'application' : 'default',
            appId: actual.status === 'application' ? actual.id : undefined,
        });
    };

    const moveScheduleToDate = async (schedule: DailySchedule, targetDate: string) => {
        if (schedule.source === 'google_readonly') {
            const existingInternal = normalizedSchedules.find(
                (item) => item.source !== 'google_readonly' && item.google_event_id === schedule.google_event_id
            );

            if (existingInternal) {
                await actions.updateScheduleAction(existingInternal.id, { schedule_date: targetDate });
                return;
            }

            await actions.createScheduleAction({
                case_name: schedule.case_name || schedule.title || '從 Google 匯入',
                schedule_date: targetDate,
                start_time: schedule.start_time ? `${schedule.start_time}:00` : null,
                end_time: schedule.end_time ? `${schedule.end_time}:00` : null,
                address: schedule.address || null,
                description: schedule.description || null,
                status: schedule.status && schedule.status !== 'application' ? schedule.status : 'pending_claim',
                case_type: schedule.case_type || '其他',
                google_event_id: schedule.google_event_id,
                sync_status: 'synced'
            } as any);
            return;
        }

        await actions.updateScheduleAction(schedule.id, { schedule_date: targetDate });
    };

    const formatDate = (date: Date) => {
        const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
        return `${date.getFullYear()}年 ${months[date.getMonth()]}`;
    };

    const handleAddTodo = async () => {
        if (!newTodoTitle.trim()) return;
        try {
            await actions.createTodoAction(newTodoTitle);
            setNewTodoTitle("");
            fetchTodos();
        } catch (e: any) {
            alert(`新增失敗：\n${e.message}`);
        }
    };

    const handleAddPersonalTodo = async () => {
        if (!newPersonalTodoTitle.trim()) return;
        try {
            await actions.createTodoAction(`[PERSONAL] ${newPersonalTodoTitle}`);
            setNewPersonalTodoTitle("");
            fetchTodos();
        } catch (e: any) {
            alert(`新增個人待辦失敗：\n${e.message}`);
        }
    };

    const handleToggleTodo = async (todo: TodoItem) => {
        setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, is_completed: !t.is_completed } : t));
        try {
            await actions.updateTodoAction(todo.id, { is_completed: !todo.is_completed });
            fetchTodos();
        } catch (error: any) {
            fetchTodos();
        }
    };

    const handleDeleteTodo = async (id: string) => {
        const todoToDelete = todos.find(t => t.id === id);
        if (!todoToDelete) return;
        setTodos(prev => prev.filter(t => t.id !== id));
        setDeletedTodos(prev => [todoToDelete, ...prev].slice(0, 10));
        try {
            await actions.deleteTodoAction(id);
        } catch (error: any) {
            fetchTodos();
            setDeletedTodos(prev => prev.filter(t => t.id !== id));
        }
    };

    const handleRestoreTodo = async (todo: TodoItem) => {
        try {
            await actions.createTodoAction(todo.title);
            setDeletedTodos(prev => prev.filter(t => t.id !== todo.id));
            fetchTodos();
        } catch (error: any) {
            alert(`復原失敗:\n${error.message}`);
        }
    };

    const handleQuickComplete = async (schedule: DailySchedule) => {
        try {
            await actions.updateScheduleAction(schedule.id, { status: schedule.status === 'done' ? 'scheduled' : 'done' });
            refreshSchedules();
        } catch (error: any) {
            console.error('Complete Schedule Error:', error);
        }
    };

    const handleModalSave = async (data: Partial<DailySchedule>, action: 'save' | 'accept' | 'reject') => {
        if (action === 'reject') {
            const deleteId = modalConfig.appId || modalConfig.initialData?.id || data.id;
            if (!deleteId) return;
            try {
                await actions.deleteScheduleAction(deleteId);
                await fetchExternalApps();
                refreshSchedules();
                setModalConfig({ isOpen: false });
            } catch (err: any) {
                alert(`拒絶失敗：\n${err.message}`);
            }
            return;
        }
        if (modalConfig.mode === 'todo_promotion') {
            const hasDate = !!data.schedule_date && data.schedule_date !== '1970-01-01';
            const hasTime = !!data.start_time;
            if (!hasDate || !hasTime) {
                alert("點下去有時間就加入排程，沒時間請先填寫日期與時間。");
                return;
            }
            try {
                const finalStatus = 'scheduled';
                const finalCaseType = (data.case_type === '任務申請' || !data.case_type) ? '進場' : data.case_type;
                await actions.createScheduleAction({
                    ...data,
                    status: finalStatus,
                    case_type: finalCaseType,
                    schedule_date: data.schedule_date
                } as any);
                if (modalConfig.todoId) {
                    await actions.deleteTodoAction(modalConfig.todoId);
                }
                fetchTodos();
                refreshSchedules();
                setModalConfig({ isOpen: false });
            } catch (err: any) {
                alert(`提升為排程失敗：\n${err.message}`);
            }
            return;
        }
        if (modalConfig.mode === 'application') {
            if (action === 'save') {
                try {
                    if (modalConfig.appId) {
                        await actions.updateScheduleAction(modalConfig.appId, {
                            ...data,
                            status: 'application'
                        } as any);
                    } else {
                        await actions.createScheduleAction({
                            ...data,
                            status: 'application',
                            schedule_date: data.schedule_date || null,
                            case_name: data.case_name || "未命名任務"
                        } as any);
                    }
                    await fetchExternalApps();
                    refreshSchedules();
                } catch (err: any) {
                    alert(`儲存申請失敗：\n${err.message}`);
                }
            } else if (action === 'accept') {
                const hasDate = !!data.schedule_date && data.schedule_date !== '1970-01-01';
                const hasTime = !!data.start_time;
                try {
                    if (!hasDate) {
                        const todoTitle = `[${data.case_type && data.case_type !== '任務申請' ? data.case_type : '待辦'}] ${data.case_name || '未命名'} ${data.address ? `(${data.address})` : ''}`.trim();
                        await actions.createTodoAction(todoTitle);
                        await actions.deleteScheduleAction(modalConfig.appId!);
                    } else {
                        const finalCaseType = (data.case_type === '任務申請' || !data.case_type) ? '進場' : data.case_type;
                        await actions.updateScheduleAction(modalConfig.appId!, {
                            ...data,
                            status: hasTime ? 'scheduled' : 'pending_claim',
                            schedule_date: data.schedule_date,
                            case_type: finalCaseType,
                        } as any);
                    }
                    await fetchExternalApps();
                    fetchTodos();
                    refreshSchedules();
                } catch (err: any) {
                    alert(`審核操作失敗：\n${err.message}`);
                }
            }
            setModalConfig({ isOpen: false });
            return;
        }
        if (action === 'save') {
            refreshSchedules();
        }
        setModalConfig({ isOpen: false });
    };

    const getStatusLabel = (status?: string | null) => {
        switch (status) {
            case 'pending_claim': return '待領取';
            case 'scheduled': return '已排程';
            case 'done': return '完成';
            case 'cancelled': return '取消';
            case 'application': return '申請中';
            default: return '待定';
        }
    };

    const statusColors: Record<string, string> = {
        application: 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-200',
        pending_claim: 'bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-200',
        scheduled: 'bg-sky-50 border-sky-300 text-sky-700 dark:bg-sky-900/20 dark:border-sky-700 dark:text-sky-200',
        done: 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/10 dark:border-emerald-800 dark:text-emerald-300',
        cancelled: 'bg-slate-100 border-slate-300 text-slate-500 dark:bg-slate-900/20 dark:border-slate-700 dark:text-slate-400',
    };

    // Purpose badge color by case_type (Soft background, bold text)
    const purposeColors: Record<string, string> = {
        '掛表': 'bg-red-50 text-red-600 border-red-100',
        '停電': 'bg-red-50 text-red-600 border-red-100',
        '進場': 'bg-red-50 text-red-600 border-red-100',
        '現勘': 'bg-red-50 text-red-600 border-red-100',

        '建置': 'bg-orange-50 text-orange-600 border-orange-100',

        '維修': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        '電檢': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        '驗收': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        '清洗': 'bg-emerald-50 text-emerald-600 border-emerald-100',

        '內勤': 'bg-sky-50 text-sky-600 border-sky-100',
        '其他': 'bg-sky-50 text-sky-600 border-sky-100',

        '休假': 'bg-red-600 text-white border-red-700',
    };

    const purposeBorderColors: Record<string, string> = {
        '掛表': 'border-l-4 border-red-500',
        '停電': 'border-l-4 border-red-500',
        '進場': 'border-l-4 border-red-500',
        '現勘': 'border-l-4 border-red-500',
        '建置': 'border-l-4 border-orange-500',
        '維修': 'border-l-4 border-emerald-500',
        '電檢': 'border-l-4 border-emerald-500',
        '驗收': 'border-l-4 border-emerald-500',
        '清洗': 'border-l-4 border-emerald-500',
        '內勤': 'border-l-4 border-sky-500',
        '其他': 'border-l-4 border-sky-500',
        '休假': 'border-l-4 border-red-700',
    };

    const renderCardSummary = (s: DailySchedule) => {
        const { title, aux, region: projectRegion } = formatProjectName(s.case_name);
        const region = projectRegion || extractRegion(s.address, null);
        const mainEngineer = allStaff.find(st => st.id === s.engineer_id);
        const helpers = (s.assignee_ids || []).map(id => allStaff.find(st => st.id === id)?.name).filter(Boolean);
        const isDone = s.status === 'done';
        const purpose = s.case_type || '其他';
        const purposeColor = purposeColors[purpose] || purposeColors['其他'];
        const isOnsitePurpose = purpose === '進場';
        const timeStr = s.is_all_day ? '全天' : (s.start_time?.slice(0, 5) || '未定');

        return (
            <div className="flex flex-col gap-2 text-sm leading-tight">
                {/* Layer 1: Purpose & Region */}
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className={`${isOnsitePurpose ? "text-[14px] px-3 py-1 rounded-lg shadow-md ring-2 ring-red-200/80 dark:ring-red-900/60" : "text-[12px] px-2 py-0.5 rounded"} font-black border tracking-tight shrink-0 ${purposeColor}`}>
                        {purpose}
                    </span>
                    {region && (
                        <span className="text-[11px] font-bold text-zinc-400 bg-zinc-50 border border-zinc-100 px-1.5 py-0.5 rounded truncate">
                            {region}
                        </span>
                    )}
                    {s.sync_status === 'synced' && <div className="w-2 h-2 rounded-full bg-emerald-500 ml-auto shrink-0" title="已同步 Google" />}
                </div>

                {/* Layer 2: Project Name (Primary Identifier, Bold & Large) */}
                <h4 className={`font-black text-[18px] leading-[1.3] line-clamp-2 tracking-tight ${isDone ? 'text-zinc-400 line-through' : 'text-zinc-800 dark:text-zinc-50'}`} title={s.case_name || ''}>
                    {title}
                </h4>

                {/* Layer 3: Address (One line) */}
                {s.address && (
                    <div className="flex items-center gap-1 text-[13px] text-zinc-500 dark:text-zinc-400 font-medium">
                        <svg className="w-3.5 h-3.5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="truncate">{s.address}</span>
                    </div>
                )}

                {/* Layer 4: Time + Personnel (Names listed directly) */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 mt-1">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className="font-bold text-[13px] text-zinc-800 dark:text-zinc-200 shrink-0">{timeStr}</span>
                        {(mainEngineer || helpers.length > 0) && (
                            <div className="flex items-center gap-1 text-[13px] font-black text-zinc-900 dark:text-zinc-100 truncate">
                                {mainEngineer && <span>{mainEngineer.name}</span>}
                                {helpers.length > 0 && (
                                    <span className="text-zinc-400">
                                        {mainEngineer ? '、' : ''}{helpers.join('、')}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-full gap-3 overflow-hidden p-3 bg-zinc-50/50 dark:bg-black/20">
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 transition-all overflow-hidden">
                <div className="flex items-center justify-between mb-6 px-4 pt-6 shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
                            <button onClick={() => setActiveTab("week")} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTab === "week" ? "bg-white dark:bg-zinc-700 text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`} >周排程</button>
                            <button onClick={() => setActiveTab("month")} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTab === "month" ? "bg-white dark:bg-zinc-700 text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`} >月排程</button>
                            <button onClick={() => setActiveTab("tracking")} className={`px-5 py-2 text-base font-bold rounded-xl transition-all ${activeTab === "tracking" ? "bg-white dark:bg-zinc-700 text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`} >任務追蹤</button>
                        </div>
                        {activeTab !== "tracking" && (
                            <div className="flex items-center gap-3">
                                <button onClick={() => navigate(-1)} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 border border-transparent hover:border-zinc-200"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                                <span className="text-lg font-black text-zinc-900 dark:text-zinc-100 min-w-[160px] text-center tracking-tight">{formatDate(currentDate)}</span>
                                <button onClick={() => navigate(1)} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 border border-transparent hover:border-zinc-200"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                                <button onClick={handleToday} className="ml-2 px-4 py-2 text-sm font-black text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-900/30 rounded-xl transition-all">今天</button>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setModalConfig({ isOpen: true, initialData: { status: 'pending_claim' } as DailySchedule })} className="flex items-center gap-2.5 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-base font-black shadow-xl shadow-blue-500/30 transition-all active:scale-95 glow-blue" > <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg> 新增排程 </button>
                </div>
                <div className="flex-1 overflow-auto no-scrollbar p-3 bg-zinc-50/50 dark:bg-black/10">
                    {activeTab === "week" && (
                        <div className="grid grid-cols-7 min-w-[900px] gap-2 h-full min-h-[600px]">
                            {weekDays.map((date, idx) => {
                                const dateSimple = formatLocalDate(date);
                                const isToday = dateSimple === todayStr;
                                const daySchedules = getSchedulesForDay(date);
                                const dayName = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"][idx];
                                return (
                                    <div key={idx} onDoubleClick={() => setModalConfig({ isOpen: true, initialDate: dateSimple, initialData: { status: 'pending_claim' } as DailySchedule })} className={`flex flex-col h-full bg-white dark:bg-zinc-900 border-2 transition-all ${isToday ? 'border-amber-400 shadow-2xl ring-4 ring-amber-500/5 scale-[1.02] z-10' : 'border-zinc-100 dark:border-zinc-800 shadow-sm'} overflow-hidden hover:shadow-lg hover:border-zinc-300 rounded-3xl`} >
                                        <div className={`px-2 py-5 flex flex-col items-center justify-center border-b-2 gap-1 ${isToday ? 'bg-amber-50/80 border-amber-200' : 'bg-zinc-50/30 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800'}`}>
                                            <span className={`text-4xl font-black tracking-tighter ${isToday ? 'text-amber-600' : 'text-zinc-900 dark:text-zinc-100'}`}>{date.getDate()}</span>
                                            <span className={`text-[16px] font-black tracking-widest ${isToday ? 'text-amber-500' : 'text-zinc-500'}`}>{dayName}</span>
                                        </div>
                                        <div 
                                            className="flex-1 p-1 overflow-y-auto no-scrollbar space-y-2" 
                                            onDragOver={(e) => e.preventDefault()} 
                                            onDrop={async (e) => { 
                                                e.preventDefault(); 
                                                const todoStr = e.dataTransfer.getData("todo"); 
                                                const scheduleStr = e.dataTransfer.getData("schedule"); 
                                                
                                                if (todoStr) {
                                                    const todo = JSON.parse(todoStr);
                                                    console.log("[WeeklyView] Drop Todo", todo.id, "to", dateSimple);
                                                    try {
                                                        await actions.createScheduleAction({
                                                            case_name: todo.title,
                                                            schedule_date: dateSimple,
                                                            status: 'pending_claim',
                                                            case_type: '其他'
                                                        } as any);
                                                        await actions.deleteTodoAction(todo.id);
                                                        fetchTodos();
                                                        refreshSchedules();
                                                    } catch (err: any) {
                                                        console.error("[WeeklyView] Todo transfer failed", err);
                                                        alert(`拖曳轉入失敗：\n${err.message}`);
                                                    }
                                                } else if (scheduleStr) {
                                                    const schedule = JSON.parse(scheduleStr);
                                                    console.log("[WeeklyView] Drop Schedule", schedule.id, "to", dateSimple);
                                                    try {
                                                        // Important: Pass relevant info for Google Adoption if first move
                                                        if (schedule.source === 'google_readonly') {
                                                            await moveScheduleToDate(schedule, dateSimple);
                                                            refreshSchedules();
                                                            return;
                                                        }

                                                        const updates: any = { schedule_date: dateSimple };
                                                        if (schedule.source === 'google_readonly') {
                                                            updates.case_name = schedule.case_name || schedule.title;
                                                            updates.description = schedule.description;
                                                            updates.address = schedule.address;
                                                            // Pass times so they don't get reset to 00:00:00 during adoption
                                                            updates.start_time = schedule.start_time ? `${schedule.start_time}:00` : null;
                                                            updates.end_time = schedule.end_time ? `${schedule.end_time}:00` : null;
                                                            updates.case_type = schedule.case_type || '其他';
                                                        }
                                                        
                                                        await actions.updateScheduleAction(schedule.id, updates);
                                                        refreshSchedules();
                                                    } catch (err: any) {
                                                        console.error("[WeeklyView] Schedule move failed", err);
                                                        alert(`移動排程失敗：\n${err.message}`);
                                                    }
                                                }
                                            }} 
                                        >
                                            {daySchedules.length === 0 ? (
                                                <div className="h-full flex items-center justify-center cursor-pointer group py-10" onClick={() => setModalConfig({ isOpen: true, initialDate: dateSimple, initialData: { status: 'pending_claim' } as DailySchedule })} >
                                                    <div className="text-[10px] text-zinc-300 dark:text-zinc-700 font-black group-hover:text-blue-400 group-hover:scale-110 transition-all italic tracking-widest"> EMPTY </div>
                                                </div>
                                            ) : (
                                                daySchedules.map(s => {
                                                    const isDone = s.status === 'done';
                                                    const isGoogle = s.source === 'google_readonly';
                                                    const cardBackgroundClass = isGoogle
                                                        ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-700'
                                                        : isDone
                                                            ? 'opacity-50 grayscale bg-zinc-50 border-zinc-300 dark:bg-zinc-800/20'
                                                            : 'bg-white border-zinc-200 dark:bg-zinc-900/10 dark:border-zinc-700';
                                                    const caseTypeAccent = purposeBorderColors[s.case_type || '其他'] || 'border-l-4 border-zinc-300';

                                                    return (
                                                        <div
                                                            key={s.id}
                                                            draggable={true}
                                                            onDragStart={(e) => { 
                                                                console.log("[WeeklyView] Drag Start", s.id);
                                                                e.dataTransfer.setData("schedule", JSON.stringify(s)); 
                                                            }}
                                                            onClick={(e) => { if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return; openScheduleModal(s); }}
                                                            className={`p-3.5 rounded-2xl border transition-all hover:shadow-xl active:scale-[0.98] cursor-grab active:cursor-grabbing ${isDone ? 'opacity-50 grayscale bg-zinc-50 border-zinc-100' : 'bg-white border-zinc-200 shadow-sm'}`}
                                                           >
                                                                {!isGoogle && (
                                                                    <button onClick={() => handleQuickComplete(s)} className={`absolute top-2.5 right-2.5 p-1 rounded-lg transition-all z-10 ${isDone ? 'bg-emerald-500 text-white' : 'bg-white/90 text-zinc-400 hover:text-emerald-500 border border-zinc-100 shadow-sm opacity-0 group-hover/item:opacity-100'}`} > <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> </button>
                                                                )}
                                                            {renderCardSummary(s)}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                        <button onClick={() => setModalConfig({ isOpen: true, initialDate: dateSimple, initialData: { status: 'pending_claim' } as DailySchedule })} className="py-2.5 text-[10px] font-black text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 border-t border-zinc-100 dark:border-zinc-800 transition-colors uppercase tracking-widest" > ＋Add </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {activeTab === "month" && (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden flex flex-col h-full min-h-[600px] shadow-inner">
                            <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                                {["週一", "週二", "週三", "週四", "週五", "週六", "週日"].map(d => ( <div key={d} className="py-3 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">{d}</div> ))}
                            </div>
                            <div className="grid grid-cols-7 flex-1">
                                {monthDays.map((date, idx) => {
                                    const dateStr = formatLocalDate(date); const isCurrentMonth = date.getMonth() === currentDate.getMonth(); const daySchedules = getSchedulesForDay(date); const isToday = dateStr === todayStr;
                                    return (
                                        <div 
                                            key={idx} 
                                            className={`min-h-[120px] p-2 border-r border-b border-zinc-50 dark:border-zinc-800/50 last:border-r-0 flex flex-col ${isCurrentMonth ? 'hover:bg-zinc-50/50 transition-colors' : 'bg-zinc-50/30 dark:bg-zinc-900/10 opacity-30 pointer-events-none'}`}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={async (e) => {
                                                e.preventDefault();
                                                if (!isCurrentMonth) return;
                                                const scheduleStr = e.dataTransfer.getData("schedule");
                                                if (scheduleStr) {
                                                    const schedule = JSON.parse(scheduleStr);
                                                    console.log("[MonthView] Drop Schedule", schedule.id, "to", dateStr);
                                                    try {
                                                        if (schedule.source === 'google_readonly') {
                                                            await moveScheduleToDate(schedule, dateStr);
                                                            refreshSchedules();
                                                            return;
                                                        }

                                                        const updates: any = { schedule_date: dateStr };
                                                        if (schedule.source === 'google_readonly') {
                                                            updates.case_name = schedule.case_name || schedule.title;
                                                            updates.description = schedule.description;
                                                            updates.address = schedule.address;
                                                            updates.start_time = schedule.start_time ? `${schedule.start_time}:00` : null;
                                                            updates.end_time = schedule.end_time ? `${schedule.end_time}:00` : null;
                                                            updates.case_type = schedule.case_type || '其他';
                                                        }
                                                        await actions.updateScheduleAction(schedule.id, updates);
                                                        refreshSchedules();
                                                    } catch (err: any) {
                                                        console.error("[MonthView] Schedule move failed", err);
                                                        alert(`移動排程失敗：\n${err.message}`);
                                                    }
                                                }
                                            }}
                                            onDoubleClick={() => isCurrentMonth && setModalConfig({ isOpen: true, initialDate: dateStr, initialData: { status: 'pending_claim' } as DailySchedule })}
                                        >
                                            <div className="flex justify-end mb-1"> <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${isToday ? 'bg-amber-400 text-white shadow-lg shadow-amber-500/30' : 'text-zinc-500'}`}> {date.getDate()} </span> </div>
                                            <div className="flex-1 space-y-1 overflow-hidden">
                                                {daySchedules.map(s => {
                                                    const isGoogle = s.source === 'google_readonly';
                                                    return (
                                                        <div 
                                                            key={s.id}
                                                            draggable={!isGoogle}
                                                            onDragStart={(e) => { 
                                                                if (isGoogle) {
                                                                    e.preventDefault();
                                                                    return;
                                                                }
                                                                console.log("[MonthView] Drag Start", s.id);
                                                                e.dataTransfer.setData("schedule", JSON.stringify(s)); 
                                                            }}
                                                            onClick={(e) => { e.stopPropagation(); if (isGoogle) return; openScheduleModal(s); }} 
                                                            className={`px-2 py-1.5 text-[12px] font-black rounded-lg truncate border shadow-sm transition-all cursor-grab active:cursor-grabbing ${isGoogle ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : `${s.status === 'done' ? 'opacity-40 grayscale' : statusColors[s.status || 'pending_claim']}`}`} 
                                                        > 
                                                            {s.case_type ? `[${s.case_type}] ` : ''}{s.case_name} 
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {activeTab === "tracking" && (
                        <div className="flex flex-col bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden h-full min-h-[600px]">
                            <div className="px-6 py-5 bg-zinc-50/80 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-3">任務追蹤</h3>
                                <div className="flex gap-2"> {['pending_claim', 'scheduled', 'done'].map(s => ( <div key={s} className={`w-3 h-3 rounded-full ${s === 'pending_claim' ? 'bg-amber-400' : s === 'scheduled' ? 'bg-blue-400' : 'bg-emerald-400'}`} /> ))} </div>
                            </div>
                            <div className="px-6 py-5 bg-blue-50/30 dark:bg-blue-900/5 border-b border-blue-100 dark:border-blue-900/20 flex gap-3">
                                <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} onKeyDown={async (e) => { if (e.key === 'Enter' && newTaskTitle.trim()) { try { await actions.createScheduleAction({ case_name: newTaskTitle, status: 'application', case_type: '其他' } as any); setNewTaskTitle(""); await fetchExternalApps(); refreshSchedules(); } catch (err: any) { alert(`申請失敗：\n${err.message}`); } } }} placeholder="快速輸入案場名稱..." className="flex-1 bg-white dark:bg-zinc-800 border-2 border-blue-100 dark:border-blue-900/30 rounded-2xl px-5 py-2.5 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm" />
                                <button onClick={async () => { if (newTaskTitle.trim()) { try { await actions.createScheduleAction({ case_name: newTaskTitle, status: 'application', case_type: '其他' } as any); setNewTaskTitle(""); await fetchExternalApps(); refreshSchedules(); } catch (err: any) { alert(`申請失敗：\n${err.message}`); } } }} className="px-8 bg-blue-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all"> 申請 </button>
                            </div>
                            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
                                {schedules.filter(s => s.status !== 'done' || (new Date(s.updated_at || 0).getTime() > Date.now() - 43200000)).sort((a,b) => (a.schedule_date||"").localeCompare(b.schedule_date||"")).map(s => (
                                    <div key={s.id} onClick={() => setModalConfig({ isOpen: true, initialData: s })} className={`p-5 rounded-3xl border-2 transition-all cursor-pointer hover:shadow-xl ${s.status === 'done' ? 'opacity-40 grayscale bg-zinc-50' : 'bg-white group-hover:scale-[1.01]'}`} style={{ borderLeftColor: s.status === 'pending_claim' ? '#fbbf24' : '#3b82f6' }}>
                                        <div className="flex justify-between items-center mb-3"> <span className="text-[10px] font-black px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 uppercase tracking-widest">{getStatusLabel(s.status)}</span> <span className="text-[10px] font-black text-zinc-300 font-mono italic">{s.schedule_date || 'NO DATE'}</span> </div>
                                        <h4 className="text-base font-black text-zinc-800 dark:text-zinc-100 mb-2 truncate">{s.case_name}</h4>
                                        <div className="flex items-center gap-2"> <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center text-[10px] font-black">{allStaff.find(st => st.id === s.engineer_id)?.name?.charAt(0) || '?'}</div> <span className="text-xs font-bold text-zinc-500">{allStaff.find(st => st.id === s.engineer_id)?.name || '未定'}</span> </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="w-60 flex flex-col shrink-0 h-full overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-lg">
                <div style={{ flexBasis: `${leftHeights[0]}px`, minHeight: '120px' }} className="flex flex-col shrink-0 overflow-hidden">
                    <div className="px-3 py-2.5 bg-zinc-50/80 dark:bg-zinc-800/80 border-b border-zinc-200 flex items-center justify-between shrink-0"> <h3 className="text-xs font-black text-zinc-900 flex items-center gap-1.5"> <span className="w-2 h-2 bg-emerald-500 rounded-full" /> 團隊待辦 </h3> </div>
                    <div className="px-2.5 py-2 flex gap-1.5"> <input type="text" value={newTodoTitle} onChange={(e)=>setNewTodoTitle(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&handleAddTodo()} placeholder="新增事項..." className="flex-1 bg-zinc-100 border-none rounded-lg px-3 py-1.5 text-xs font-bold outline-none" /> <button onClick={handleAddTodo} className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-sm active:scale-90 transition-all"> <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg> </button> </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar px-2.5 py-1.5 space-y-1.5"> {teamTodosList.map(t => ( <div key={t.id} className="px-2 py-1.5 bg-white border border-zinc-100 rounded-xl shadow-sm flex items-center gap-2 cursor-pointer hover:shadow-md transition-all" onClick={()=>setModalConfig({isOpen:true, initialData:{case_name:t.displayTitle||t.title, status:'pending_claim'} as any, mode:'todo_promotion', todoId:t.id})}> <button onClick={(e)=>{e.stopPropagation(); handleToggleTodo(t)}} className={`shrink-0 w-4 h-4 rounded-md border-2 transition-all flex items-center justify-center ${t.is_completed?'bg-emerald-500 border-emerald-500 text-white':'border-zinc-200'}`}>{t.is_completed&&<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}</button> <span className={`text-[11px] font-bold truncate ${t.is_completed?'text-zinc-300 line-through':'text-zinc-700'}`}>{t.displayTitle}</span> </div> ))} </div>
                </div>
                <div className="h-1 bg-zinc-100 hover:bg-blue-400 cursor-row-resize shrink-0 transition-colors z-10" onMouseDown={() => { isDraggingRef.current = 0; document.body.classList.add("cursor-row-resize", "select-none"); }} />
                <div style={{ flexBasis: `${leftHeights[1]}px`, minHeight: '120px' }} className="flex flex-col border-y border-zinc-200 overflow-hidden shrink-0">
                    <div className="px-3 py-2.5 bg-zinc-50 border-b flex items-center justify-between shrink-0"> <h3 className="text-xs font-black text-zinc-900 flex items-center gap-1.5"> <span className="w-2 h-2 bg-blue-500 rounded-full" /> 個人待辦 </h3> </div>
                    <div className="px-2.5 py-2 flex gap-1.5"> <input ref={personalInputRef} type="text" value={newPersonalTodoTitle} onChange={(e)=>setNewPersonalTodoTitle(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&handleAddPersonalTodo()} placeholder="我的事項..." className="flex-1 bg-zinc-100 border-none rounded-lg px-3 py-1.5 text-xs font-bold outline-none" /> <button onClick={handleAddPersonalTodo} className="p-1.5 bg-blue-600 text-white rounded-lg shadow-sm active:scale-90 transition-all"> <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg> </button> </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar px-2.5 py-1.5 space-y-1.5"> {personalTodosList.map(t => ( <div key={t.id} className="px-2 py-1.5 bg-white border border-zinc-100 rounded-xl shadow-sm flex items-center gap-2 cursor-pointer hover:shadow-md transition-all" onClick={()=>setModalConfig({isOpen:true, initialData:{case_name:t.displayTitle||t.title, status:'pending_claim'} as any, mode:'todo_promotion', todoId:t.id})}> <button onClick={(e)=>{e.stopPropagation(); handleToggleTodo(t)}} className={`shrink-0 w-4 h-4 rounded-md border-2 transition-all flex items-center justify-center ${t.is_completed?'bg-blue-500 border-blue-500 text-white':'border-zinc-200'}`}>{t.is_completed&&<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}</button> <span className={`text-[11px] font-bold truncate ${t.is_completed?'text-zinc-300 line-through':'text-zinc-700'}`}>{t.displayTitle}</span> </div> ))} </div>
                </div>
                <div className="h-1 bg-zinc-100 hover:bg-blue-400 cursor-row-resize shrink-0 transition-colors z-10" onMouseDown={() => { isDraggingRef.current = 1; document.body.classList.add("cursor-row-resize", "select-none"); }} />
                <div className="flex-1 flex flex-col overflow-hidden shrink-0">
                    <div className="px-3 py-2.5 bg-zinc-50 border-b flex items-center justify-between shrink-0"> <h3 className="text-xs font-black text-zinc-900 flex items-center gap-1.5"> <span className="w-2 h-2 bg-amber-500 rounded-full" /> 任務申請 </h3> </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar px-2.5 py-2 space-y-2">
                        {externalApps.map(app => (
                            <div key={app.id} onClick={()=>setModalConfig({isOpen:true, initialData:app, mode:'application', appId:app.id})} className="p-4 bg-white border-2 border-zinc-50 rounded-2xl shadow-sm cursor-pointer hover:shadow-xl transition-all group">
                                <div className="flex justify-between items-start mb-2"> <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded">PENDING</div> <button onClick={(e)=>{e.stopPropagation(); setExternalApps(prev=>prev.filter(i=>i.id!==app.id)); actions.deleteScheduleAction(app.id).then(()=>refreshSchedules())}} className="opacity-0 group-hover:opacity-100 p-1 text-zinc-300 hover:text-red-500 transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button> </div>
                                <div className="text-xs font-black text-zinc-800 line-clamp-2 leading-snug">{app.case_name}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <ScheduleModal isOpen={modalConfig.isOpen} onClose={() => setModalConfig({ isOpen: false })} onSave={handleModalSave} initialData={modalConfig.initialData} initialDate={modalConfig.initialDate} mode={modalConfig.mode} />
        </div>
    );
}
