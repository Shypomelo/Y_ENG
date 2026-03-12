"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { DailySchedule, TodoItem } from "../../../lib/types/database";
import { useProjects } from "../../providers/projects-store";
import ScheduleModal from "./ScheduleModal";
import * as actions from "../actions";

interface WeeklyViewProps {
    schedules: DailySchedule[];
    refreshSchedules: () => void;
}

// Helper for local date string YYYY-MM-DD
const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function WeeklyView({ schedules, refreshSchedules }: WeeklyViewProps) {
    const { peopleByDept, projects } = useProjects();
    const [activeTab, setActiveTab] = useState<"week" | "month" | "tracking">("week");
    const [currentDate, setCurrentDate] = useState(new Date());
    const [newTaskTitle, setNewTaskTitle] = useState(""); // For "任務申請"

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

                // Constraints to prevent collapsing fully
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
        const diff = d.getDate() - (day === 0 ? 6 : day - 1); // Monday start
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
        // Fill leading empty days
        const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        for (let i = startPadding; i > 0; i--) {
            const d = new Date(year, month, 1 - i);
            days.push(d);
        }
        // Current month days
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }
        // Fill trailing empty days to make full weeks (up to 42 days for 6 rows)
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
            alert(`讀取待辦失敗：\n${e.message}`);
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

    const getSchedulesForDay = (date: Date) => {
        const dateStr = formatLocalDate(date);
        return schedules
            .filter(s => s.schedule_date === dateStr && s.status !== 'application' && s.case_type !== '任務申請')
            .sort((a, b) => {
                const timeA = a.start_time || "99:99";
                const timeB = b.start_time || "99:99";
                return timeA.localeCompare(timeB);
            });
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
        // Optimistic update
        setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, is_completed: !t.is_completed } : t));
        try {
            await actions.updateTodoAction(todo.id, { is_completed: !todo.is_completed });
            fetchTodos();
        } catch (error: any) {
            console.error('Toggle Todo Error:', error);
            alert(`更新狀態失敗:\n${error.message}`);
            fetchTodos(); // Revert on error
        }
    };

    const handleDeleteTodo = async (id: string) => {
        const todoToDelete = todos.find(t => t.id === id);
        if (!todoToDelete) return;

        // Optimistic update
        setTodos(prev => prev.filter(t => t.id !== id));
        setDeletedTodos(prev => [todoToDelete, ...prev].slice(0, 10)); // Keep last 10 for Undo

        try {
            await actions.deleteTodoAction(id);
            // We don't call fetchTodos() immediately to avoid jumpy UI, 
            // the local state is enough. Tracking tab will show "Restore".
        } catch (error: any) {
            console.error('Delete Todo Error:', error);
            alert(`刪除失敗:\n${error.message}`);
            fetchTodos(); // Restore if failed
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
            alert(`標記完成失敗:\n${error.message}`);
        }
    };

    const handleModalSave = async (data: Partial<DailySchedule>, action: 'save' | 'accept' | 'reject') => {
        // 1. Double-click rejection
        if (action === 'reject') {
            const deleteId = modalConfig.appId || modalConfig.initialData?.id || data.id;
            if (!deleteId) {
                alert("刪除失敗：缺少編號");
                return;
            }
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

        // 2. Todo Promotion
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

        // 3. Application Flow (Submit/Accept)
        if (modalConfig.mode === 'application') {
            if (action === 'save') {
                // Draft save
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
                // Promotion logic within application review
                const hasDate = !!data.schedule_date && data.schedule_date !== '1970-01-01';
                const hasTime = !!data.start_time;

                try {
                    if (!hasDate) {
                        // Accept without date -> Promote to Todo
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

        // 4. Default Mode (Normal Edit)
        if (action === 'save') {
             // Normal edit is handled inside the modal via direct action calls, but we refresh here
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
            default: return '待定';
        }
    };

    const statusColors: Record<string, string> = {
        application: 'bg-amber-50/50 border-amber-200 text-amber-700 dark:bg-amber-900/10 dark:border-amber-900/40 dark:text-amber-300',
        pending_claim: 'bg-orange-50/50 border-orange-100 text-orange-600 dark:bg-orange-900/5 dark:border-orange-900/20 dark:text-orange-300',
        scheduled: 'bg-sky-50/50 border-sky-100 text-sky-600 dark:bg-sky-900/5 dark:border-sky-900/20 dark:text-sky-300',
        done: 'bg-emerald-50/50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/5 dark:border-emerald-900/20 dark:text-emerald-300',
        cancelled: 'bg-slate-50/50 border-slate-200 text-slate-500 dark:bg-slate-900/5 dark:border-slate-800 dark:text-slate-400',
    };


    return (
        <div className="flex h-full gap-4 overflow-hidden p-4 bg-zinc-50/50 dark:bg-black/20">
            {/* Left: Main Grid */}
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800 transition-all overflow-hidden">
                {/* Header Area ... Same as before but moved to left side of container */}
                < div className="flex items-center justify-between mb-6 px-4 pt-6 shrink-0" >
                    <div className="flex items-center gap-6">
                        <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
                            <button
                                onClick={() => setActiveTab("week")}
                                className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTab === "week" ? "bg-white dark:bg-zinc-700 text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                            >
                                周排程
                            </button>
                            <button
                                onClick={() => setActiveTab("month")}
                                className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTab === "month" ? "bg-white dark:bg-zinc-700 text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                            >
                                月排程
                            </button>
                            <button
                                onClick={() => setActiveTab("tracking")}
                                className={`px-5 py-2 text-base font-bold rounded-xl transition-all ${activeTab === "tracking" ? "bg-white dark:bg-zinc-700 text-blue-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50 dark:hover:bg-zinc-800"}`}
                            >
                                任務追蹤
                            </button>
                        </div>

                        {activeTab !== "tracking" && (
                            <div className="flex items-center gap-3">
                                <button onClick={() => navigate(-1)} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 border border-transparent hover:border-zinc-200">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <span className="text-lg font-black text-zinc-900 dark:text-zinc-100 min-w-[160px] text-center tracking-tight">
                                    {formatDate(currentDate)}
                                </span>
                                <button onClick={() => navigate(1)} className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 border border-transparent hover:border-zinc-200">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                                <button onClick={handleToday} className="ml-2 px-4 py-2 text-sm font-black text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-900/30 rounded-xl transition-all">
                                    今天
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setModalConfig({ isOpen: true, initialData: { status: 'pending_claim' } as DailySchedule })}
                        className="flex items-center gap-2.5 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-base font-black shadow-xl shadow-blue-500/30 transition-all active:scale-95 glow-blue"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                        新增任務
                    </button>
                </div>


                {/* Main Content Area */}
                <div className="flex-1 overflow-auto no-scrollbar p-6 bg-zinc-50/50 dark:bg-black/10">
                    {/* Grid Area */}
                    < div className="flex-1 overflow-auto no-scrollbar" >
                        {activeTab === "week" && (
                            <div className="grid grid-cols-7 min-w-[1000px] gap-2 h-full min-h-[600px]">
                                {weekDays.map((date, idx) => {
                                    const dateSimple = formatLocalDate(date);
                                    const isToday = dateSimple === todayStr;
                                    const daySchedules = getSchedulesForDay(date);
                                    const dayName = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"][idx];

                                    return (
                                        <div
                                            key={idx}
                                            onDoubleClick={() => setModalConfig({ isOpen: true, initialDate: dateSimple, initialData: { status: 'pending_claim' } as DailySchedule })}
                                            className={`flex flex-col h-full bg-white dark:bg-zinc-900/40 rounded-2xl border ${isToday ? 'border-blue-400 dark:border-blue-600 shadow-xl ring-2 ring-blue-500/10' : 'border-zinc-100 dark:border-zinc-800 shadow-sm'} overflow-hidden transition-all hover:shadow-lg`}
                                        >
                                            <div className={`px-2 py-3 flex flex-col items-center justify-center border-b ${isToday ? 'bg-blue-600 border-blue-600' : 'bg-zinc-50 dark:bg-zinc-800/70 border-zinc-100 dark:border-zinc-800'}`}>
                                                <span className={`text-[10px] font-black mb-1 tracking-wider ${isToday ? 'text-blue-100' : 'text-zinc-400 dark:text-zinc-500 uppercase'}`}>{dayName}</span>
                                                <span className={`text-xl font-black ${isToday ? 'text-white' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                                    {date.getDate()}
                                                </span>
                                            </div>

                                            <div
                                                className="flex-1 p-2 overflow-y-auto no-scrollbar space-y-2"
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={async (e) => {
                                                    e.preventDefault();
                                                    const todoStr = e.dataTransfer.getData("todo");
                                                    const scheduleStr = e.dataTransfer.getData("schedule");

                                                    if (todoStr) {
                                                        const todo = JSON.parse(todoStr);
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
                                                            console.error("Drop Error:", err);
                                                            alert(`拖曳轉入失敗：\n${err.message}`);
                                                        }
                                                    } else if (scheduleStr) {
                                                        const schedule = JSON.parse(scheduleStr);
                                                        try {
                                                            await actions.updateScheduleAction(schedule.id, {
                                                                schedule_date: dateSimple
                                                            });
                                                            refreshSchedules();
                                                        } catch (err: any) {
                                                            console.error("Move Error:", err);
                                                            alert(`移動排程失敗：\n${err.message}`);
                                                        }
                                                    }
                                                }}
                                            >
                                                {daySchedules.length === 0 ? (
                                                    <div
                                                        className="h-full flex items-center justify-center cursor-pointer group py-10"
                                                        onClick={() => setModalConfig({ isOpen: true, initialDate: dateSimple, initialData: { status: 'pending_claim' } as DailySchedule })}
                                                    >
                                                        <div className="text-[10px] text-zinc-300 dark:text-zinc-700 font-bold group-hover:text-blue-400 group-hover:scale-110 transition-all">
                                                            ＋預排項目
                                                        </div>
                                                    </div>
                                                ) : (
                                                    daySchedules.map(s => {
                                                        const project = projects.find(p => p.project_id === s.project_id);
                                                        const mainEngineer = allStaff.find(st => st.id === s.engineer_id);
                                                        const isDone = s.status === 'done';

                                                        return (
                                                            <div
                                                                key={s.id}
                                                                draggable
                                                                onDragStart={(e) => {
                                                                    e.dataTransfer.setData("schedule", JSON.stringify(s));
                                                                }}
                                                                onClick={(e) => {
                                                                    if ((e.target as HTMLElement).closest('button')) return;
                                                                    setModalConfig({ 
                                                                        isOpen: true, 
                                                                        initialData: s,
                                                                        mode: s.status === 'application' ? 'application' : 'default',
                                                                        appId: s.status === 'application' ? s.id : undefined
                                                                    });
                                                                }}
                                                                className={`p-3 rounded-xl border relative group/item transition-all hover:shadow-md active:scale-95 cursor-grab active:cursor-grabbing ${isDone ? 'opacity-50 grayscale bg-zinc-50 dark:bg-zinc-800/20 border-zinc-200' : statusColors[s.status || 'pending_claim']}`}
                                                            >
                                                                <div className="flex items-center justify-between mb-1.5">
                                                                    <div className="flex items-center gap-1 text-[10px] font-bold opacity-70">
                                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                        {s.start_time?.slice(0, 5) || "未定"}
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleQuickComplete(s)}
                                                                        className={`p-1 rounded-md transition-all ${isDone ? 'bg-emerald-500 text-white' : 'bg-white/50 text-emerald-600 hover:bg-emerald-500 hover:text-white opacity-0 group-hover/item:opacity-100'}`}
                                                                    >
                                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                                    </button>
                                                                </div>
                                                                <h4 className={`text-sm font-bold leading-tight mb-1 line-clamp-2 ${isDone ? 'line-through' : ''}`}>{s.case_name || "未命名案件"}</h4>
                                                                {s.address && (
                                                                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mb-2">
                                                                        {s.address}
                                                                    </div>
                                                                )}

                                                                {project && (
                                                                    <div className="text-[10px] font-bold bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded inline-block mb-3 max-w-full truncate border border-black/5">
                                                                        {project.project_name}
                                                                    </div>
                                                                )}

                                                                <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-black/5">
                                                                    <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px] font-bold">
                                                                        {mainEngineer?.name?.charAt(0) || "?"}
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 capitalize">{s.case_type || '一般'}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                            <button
                                                onClick={() => setModalConfig({ isOpen: true, initialDate: dateSimple, initialData: { status: 'pending_claim' } as DailySchedule })}
                                                className="py-2 text-[10px] font-bold text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 border-t border-zinc-100 dark:border-zinc-800 transition-colors"
                                            >
                                                ＋新增
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {
                            activeTab === "month" && (
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-full min-h-[600px]">
                                    <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                                        {["週一", "週二", "週三", "週四", "週五", "週六", "週日"].map(d => (
                                            <div key={d} className="py-2 text-center text-xs font-bold text-zinc-400 uppercase tracking-wider">{d}</div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 flex-1">
                                        {monthDays.map((date, idx) => {
                                            const dateStr = formatLocalDate(date);
                                            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                                            const daySchedules = getSchedulesForDay(date);
                                            const isToday = dateStr === todayStr;

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`min-h-[100px] p-1 border-r border-b border-zinc-50 dark:border-zinc-800/50 last:border-r-0 flex flex-col ${isCurrentMonth ? '' : 'bg-zinc-50/50 dark:bg-zinc-900/20 opacity-30 cursor-not-allowed pointer-events-none'}`}
                                                    onClick={() => isCurrentMonth && setModalConfig({ isOpen: true, initialDate: dateStr, initialData: { status: 'pending_claim' } as DailySchedule })}
                                                >
                                                    <div className="flex justify-end p-1">
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isToday ? 'bg-blue-600 text-white' : 'text-zinc-400'}`}>
                                                            {date.getDate()}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 space-y-0.5 overflow-hidden p-1">
                                                        {daySchedules.map(s => (
                                                            <div
                                                                key={s.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setModalConfig({ isOpen: true, initialData: s });
                                                                }}
                                                                className={`px-1.5 py-0.5 text-[9px] font-bold rounded truncate border shadow-sm cursor-pointer transition-all hover:scale-[1.05] ${s.status === 'done' ? 'opacity-40 line-through bg-zinc-100 text-zinc-400' : statusColors[s.status || 'pending_claim']}`}
                                                            >
                                                                {s.start_time?.slice(0, 5)} {s.case_name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        {
                            activeTab === "tracking" && (
                                <div className="flex flex-col bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden h-full min-h-[600px]">
                                    {/* Tracking Header */}
                                    <div className="px-6 py-5 bg-zinc-50/80 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 backdrop-blur-md">
                                        <div className="flex items-center gap-4">
                                            <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                                                <span className="w-3 h-3 bg-amber-500 rounded-full animate-pulse shadow-sm shadow-amber-200" />
                                                任務申請與追蹤
                                            </h3>
                                            <div className="flex gap-1.5">
                                                {['pending_claim', 'scheduled', 'done'].map(s => (
                                                    <div key={s} title={getStatusLabel(s)} className={`w-2 h-2 rounded-full ${s === 'pending_claim' ? 'bg-amber-400' : s === 'scheduled' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Task Application: Quick Add Area (Compact Version) */}
                                    <div className="px-6 py-4 bg-blue-50/50 dark:bg-blue-900/5 border-b border-blue-100 dark:border-blue-900/20 flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-black text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                快速申請新任務
                                            </h4>
                                            <span className="text-[10px] text-zinc-400 font-medium italic">版面預計優化中</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newTaskTitle}
                                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                                onKeyDown={async (e) => {
                                                    if (e.key === 'Enter') {
                                                        if (!newTaskTitle.trim()) return;
                                                        try {
                                                            await actions.createScheduleAction({
                                                                case_name: newTaskTitle,
                                                                status: 'application',
                                                                schedule_date: null, // Keep blank to show in Uygur list
                                                                case_type: '任務申請',
                                                                address: null,
                                                                start_time: null,
                                                                end_time: null,
                                                                assignee_ids: null,
                                                                engineer_id: null,
                                                                project_id: null,
                                                                description: null
                                                            });
                                                            setNewTaskTitle("");
                                                            await fetchExternalApps();
                                                            refreshSchedules();
                                                        } catch (err: any) {
                                                            alert(`申請失敗：\n${err.message}`);
                                                        }
                                                    }
                                                }}
                                                placeholder="輸入案件名稱以新增申請..."
                                                className="flex-1 bg-white dark:bg-zinc-800 border border-blue-100 dark:border-blue-900/40 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-zinc-400"
                                            />
                                            <button
                                                onClick={async () => {
                                                    if (!newTaskTitle.trim()) return;
                                                    try {
                                                        await actions.createScheduleAction({
                                                            case_name: newTaskTitle,
                                                            status: 'application',
                                                            schedule_date: null,
                                                            case_type: '任務申請',
                                                            address: null,
                                                            start_time: null,
                                                            end_time: null,
                                                            assignee_ids: null,
                                                            engineer_id: null,
                                                            project_id: null,
                                                            description: null
                                                        });
                                                        setNewTaskTitle("");
                                                        await fetchExternalApps();
                                                        refreshSchedules();
                                                    } catch (err: any) {
                                                        alert(`申請失敗：\n${err.message}`);
                                                    }
                                                }}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all active:scale-95 text-sm font-bold shadow-lg shadow-blue-500/10"
                                            >
                                                申請
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3">
                                        {deletedTodos.length > 0 && (
                                            <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
                                                <h5 className="text-[10px] font-black text-zinc-400 uppercase mb-2 flex items-center gap-2">
                                                    最近刪除 (可復原)
                                                </h5>
                                                <div className="space-y-1">
                                                    {deletedTodos.map(todo => (
                                                        <div key={todo.id} className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                                            <span className="text-xs font-bold text-zinc-500 truncate">{todo.title}</span>
                                                            <button
                                                                onClick={() => handleRestoreTodo(todo)}
                                                                className="text-[10px] font-black text-blue-600 hover:text-blue-700 underline shrink-0"
                                                            >
                                                                復原
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {schedules.length === 0 ? (
                                            <div className="text-center py-10 text-[10px] text-zinc-400 font-medium">目前尚無排程任務</div>
                                        ) : (
                                            schedules
                                                .filter(s => s.status !== 'done' || (new Date(s.updated_at || 0).getTime() > Date.now() - 43200000)) // Show done tasks for 12 hours
                                                .sort((a, b) => {
                                                    // Sort by status: pending_claim, scheduled, done, cancelled
                                                    const statusOrder: Record<string, number> = { 'pending_claim': 1, 'scheduled': 2, 'done': 3, 'cancelled': 4 };
                                                    const statusA = statusOrder[a.status || 'pending_claim'] || 99;
                                                    const statusB = statusOrder[b.status || 'pending_claim'] || 99;
                                                    if (statusA !== statusB) return statusA - statusB;

                                                    // Then by schedule date
                                                    if (a.schedule_date !== b.schedule_date) {
                                                        return new Date(a.schedule_date || '1970-01-01').getTime() - new Date(b.schedule_date || '1970-01-01').getTime();
                                                    }

                                                    // Then by start time
                                                    return (a.start_time || "").localeCompare(b.start_time || "");
                                                })
                                                .map(s => {
                                                    const mainEngineer = allStaff.find(st => st.id === s.engineer_id);
                                                    const isDone = s.status === 'done';
                                                    return (
                                                        <div
                                                            key={s.id}
                                                            onClick={(e) => {
                                                                if ((e.target as HTMLElement).closest('button')) return;
                                                                setModalConfig({ 
                                                                    isOpen: true, 
                                                                    initialData: s,
                                                                    mode: s.status === 'application' ? 'application' : 'default',
                                                                    appId: s.status === 'application' ? s.id : undefined
                                                                });
                                                            }}
                                                            className={`group relative p-3 rounded-xl border transition-all cursor-pointer border-l-4 ${isDone ? 'opacity-50 grayscale bg-zinc-50 border-zinc-200' : 'bg-white dark:bg-zinc-800/50 hover:shadow-md border-zinc-100 dark:border-zinc-800'}`}
                                                            style={{ borderLeftColor: isDone ? '#10b981' : (s.status === 'pending_claim' ? '#fbbf24' : '#3b82f6') }}
                                                        >
                                                            <div className="flex justify-between items-start mb-1.5">
                                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${isDone ? 'bg-emerald-100 text-emerald-700' : statusColors[s.status || 'pending_claim']}`}>
                                                                    {getStatusLabel(s.status)}
                                                                </span>
                                                                <button
                                                                    onClick={() => handleQuickComplete(s)}
                                                                    className={`p-1.5 rounded-lg transition-all shadow-sm ${isDone ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-400 hover:bg-emerald-500 hover:text-white border border-zinc-200'}`}
                                                                    title="標記為完成"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                                </button>
                                                            </div>
                                                            <h4 className={`text-sm font-bold text-zinc-800 dark:text-zinc-200 line-clamp-1 group-hover:text-blue-600 transition-colors ${isDone ? 'line-through' : ''}`}>{s.case_name}</h4>
                                                            <div className="mt-2 flex items-center justify-between">
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[8px] font-bold text-zinc-500 shadow-inner">
                                                                        {mainEngineer?.name?.charAt(0) || "?"}
                                                                    </div>
                                                                    <span className="text-[10px] text-zinc-500 font-bold">{mainEngineer?.name || "待領取"}</span>
                                                                </div>
                                                                <div className="text-[9px] font-black text-zinc-300">
                                                                    {(s.schedule_date || '').split('-').slice(1).join('/')}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                        )}
                                    </div>
                                </div>
                            )}
                    </div>
                </div>
            </div>

            {/* Right Sidebar: Stacked Resizable Sections */}
            <div className="w-80 flex flex-col shrink-0 h-full overflow-hidden bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl">
                {/* 1. Team Todos */}
                <div style={{ flexBasis: `${leftHeights[0]}px`, minHeight: '120px' }} className="flex flex-col shrink-0 overflow-hidden">
                    <div className="px-5 py-4 bg-zinc-50/80 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                        <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                            團隊待辦
                        </h3>
                        <span className="text-[10px] font-black px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-full">
                            {teamTodosList.filter(t => !t.is_completed).length}
                        </span>
                    </div>
                    <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newTodoTitle}
                                onChange={(e) => setNewTodoTitle(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                                placeholder="新增團隊待辦..."
                                className="flex-1 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500/20 outline-none placeholder:text-zinc-400 min-w-0"
                            />
                            <button onClick={handleAddTodo} className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all active:scale-95 shadow-sm shrink-0">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1">
                        {teamTodosList.length === 0 ? (
                            <div className="text-center py-8 text-[10px] text-zinc-300 italic">目前無事項</div>
                        ) : (
                            teamTodosList.map(todo => (
                                <div key={todo.id} className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800 shadow-sm hover:shadow-md cursor-pointer" onClick={() => setModalConfig({ isOpen: true, initialData: { case_name: todo.displayTitle || todo.title, status: 'pending_claim' } as DailySchedule, mode: 'todo_promotion', todoId: todo.id })}>
                                    <button onClick={(e) => { e.stopPropagation(); handleToggleTodo(todo); }} className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${todo.is_completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 bg-white'}`}>
                                        {todo.is_completed && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </button>
                                    <span className={`flex-1 text-xs font-bold truncate ${todo.is_completed ? 'text-zinc-400 line-through' : 'text-zinc-700 dark:text-zinc-300'}`}>{todo.displayTitle || todo.title}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTodo(todo.id); }} className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-300 hover:text-red-500 transition-all shrink-0">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Resizer 0 */}
                <div className="h-1 bg-zinc-100 hover:bg-blue-400 cursor-row-resize shrink-0 transition-colors z-10" onMouseDown={() => { isDraggingRef.current = 0; document.body.classList.add("cursor-row-resize", "select-none"); }} />

                {/* 2. Personal Todos */}
                <div style={{ flexBasis: `${leftHeights[1]}px`, minHeight: '120px' }} className="flex flex-col border-y border-zinc-200 dark:border-zinc-800 overflow-hidden shrink-0 transition-none">
                    <div className="px-5 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                        <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2 truncate">
                            <span className="w-2.5 h-2.5 shrink-0 bg-blue-500 rounded-full" />
                            個人待辦
                        </h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => personalInputRef.current?.focus()} className="p-1 text-zinc-400 hover:text-blue-600 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg></button>
                            <span className="text-[10px] font-black px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-full">{personalTodosList.filter(t => !t.is_completed).length}</span>
                        </div>
                    </div>
                    <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                        <div className="flex gap-2">
                            <input ref={personalInputRef} type="text" value={newPersonalTodoTitle} onChange={(e) => setNewPersonalTodoTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddPersonalTodo()} placeholder="新增個人待辦..." className="flex-1 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none placeholder:text-zinc-400 min-w-0" />
                            <button onClick={handleAddPersonalTodo} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all active:scale-95 shadow-sm shrink-0">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1">
                        {personalTodosList.length === 0 ? (
                            <div className="text-center py-8 text-[10px] text-zinc-300 italic">尚無個人事項</div>
                        ) : (
                            personalTodosList.map(todo => (
                                <div key={todo.id} className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800 shadow-sm hover:shadow-md cursor-pointer" onClick={() => setModalConfig({ isOpen: true, initialData: { case_name: todo.displayTitle || todo.title, status: 'pending_claim' } as DailySchedule, mode: 'todo_promotion', todoId: todo.id })}>
                                    <button onClick={(e) => { e.stopPropagation(); handleToggleTodo(todo); }} className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${todo.is_completed ? 'bg-blue-500 border-blue-500 text-white' : 'border-zinc-200 dark:border-zinc-700 hover:border-blue-500 bg-white'}`}>
                                        {todo.is_completed && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </button>
                                    <span className={`flex-1 text-xs font-bold truncate ${todo.is_completed ? 'text-zinc-400 line-through' : 'text-zinc-700 dark:text-zinc-300'}`}>{todo.displayTitle || todo.title}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTodo(todo.id); }} className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-300 hover:text-red-500 transition-all shrink-0">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Resizer 1 */}
                <div className="h-1 bg-zinc-100 hover:bg-blue-400 cursor-row-resize shrink-0 transition-colors z-10" onMouseDown={() => { isDraggingRef.current = 1; document.body.classList.add("cursor-row-resize", "select-none"); }} />

                {/* 3. Task Applications */}
                <div className="flex-1 flex flex-col overflow-hidden shrink-0">
                    <div className="px-5 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                        <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                            任務申請
                        </h3>
                        <button onClick={() => setModalConfig({ isOpen: true, mode: 'application', initialData: { status: 'application' } as DailySchedule })} className="text-[10px] font-black bg-white dark:bg-zinc-800 px-2 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 transition-all shadow-sm">＋新增</button>
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2.5">
                        {externalApps.length === 0 ? (
                            <div className="py-10 text-center text-[10px] text-zinc-300 italic font-bold">暫無任務申請</div>
                        ) : externalApps.map(app => (
                            <div key={app.id} onClick={() => setModalConfig({ isOpen: true, initialData: app, mode: 'application', appId: app.id })} className="p-3 bg-white dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl cursor-pointer hover:shadow-md transition-all group relative">
                                <div className="flex justify-between items-start mb-1">
                                    <div className="text-[9px] font-black text-amber-600">PENDING</div>
                                    <button
                                        onClick={(e) => e.stopPropagation()}
                                        onDoubleClick={async (e) => {
                                            e.stopPropagation();
                                            // Optimistic update
                                            setExternalApps(prev => prev.filter(item => item.id !== app.id));
                                            try {
                                                await actions.deleteScheduleAction(app.id);
                                                await fetchExternalApps();
                                                refreshSchedules();
                                            } catch (err: any) {
                                                alert("刪除失敗，請重新整理頁面");
                                                fetchExternalApps();
                                            }
                                        }}
                                        className="relative z-20 p-2 text-zinc-400 hover:text-red-500 transition-all rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 pointer-events-auto"
                                        title="連按兩下刪除申請"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">{app.case_name || "無標題申請"}</div>
                                {app.address && <div className="text-[9px] text-zinc-400 truncate mt-1">{app.address}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <ScheduleModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig({ isOpen: false })}
                onSave={handleModalSave}
                initialData={modalConfig.initialData}
                initialDate={modalConfig.initialDate}
                mode={modalConfig.mode}
            />
        </div >
    );
}
