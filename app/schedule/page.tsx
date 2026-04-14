"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useProjects } from "../providers/projects-store";

type ScheduleEvent = {
    id: string;
    projectId: string;
    projectName: string;
    stepId: string;
    stepName: string;
    date: string;
    isDelayed: boolean;
    delayDays: number;
    daysUntilDue: number;
};

import * as actions from "./actions";
import { DailySchedule } from "../../lib/types/database";
import WeeklyView from "./components/WeeklyView";
import GoogleSyncSettingsModal from "./components/GoogleSyncSettingsModal";

// --- Helper Functions ---
const formatLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getDaysDiff = (date1: string, date2: string) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

const getEventColorStyle = (daysUntilDue: number) => {
    if (daysUntilDue < 0) {
        return "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/40";
    } else if (daysUntilDue <= 14) {
        return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-900/40";
    } else {
        return "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40";
    }
};

const getEventStatusText = (ev: ScheduleEvent) => {
    if (ev.daysUntilDue < 0) return `逾期 ${Math.abs(ev.daysUntilDue)} 天`;
    if (ev.daysUntilDue <= 14) return `14天內 (${ev.daysUntilDue}天)`;
    return `14天外 (${ev.daysUntilDue}天)`;
};

export default function SchedulePage() {
    const router = useRouter();
    const { projects } = useProjects();
    const [activeTab, setActiveTab] = useState<"專案月曆" | "今天跑哪">("今天跑哪");
    const [activeDate, setActiveDate] = useState(new Date());
    const [selectedDateEvents, setSelectedDateEvents] = useState<{ date: string, events: ScheduleEvent[] } | null>(null);

    const [hoveredEvent, setHoveredEvent] = useState<{ ev: ScheduleEvent, x: number, y: number } | null>(null);
    const [clickedEvent, setClickedEvent] = useState<ScheduleEvent | null>(null);

    const [dbSchedules, setDbSchedules] = useState<DailySchedule[]>([]);
    const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);

    // Google Calendar Sync Settings
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const fetchAllSchedules = async () => {
        setIsLoadingSchedules(true);
        try {
            // Fetch a wide range for now to cover current view
            const start = new Date();
            start.setMonth(start.getMonth() - 3);
            const end = new Date();
            end.setMonth(end.getMonth() + 6);

            const [internalData, googleData] = await Promise.all([
                actions.getSchedulesAction(formatLocal(start), formatLocal(end)),
                actions.fetchGoogleOverlayAction(start.toISOString(), end.toISOString()).catch(e => {
                    console.error("Failed to fetch Google overlay", e);
                    return [];
                })
            ]);
            setDbSchedules([...internalData, ...googleData]);
        } catch (error: any) {
            console.error("Failed to fetch schedules", error);
            alert(`讀取排程失敗：\n${error.message}`);
        } finally {
            setIsLoadingSchedules(false);
        }
    };

    useEffect(() => {
        fetchAllSchedules();
    }, []);

    const baseDate = useMemo(() => new Date(), []);
    const monthsRange = useMemo(() => {
        const range = [];
        for (let i = -6; i <= 12; i++) {
            const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
            range.push({ year: d.getFullYear(), month: d.getMonth() });
        }
        return range;
    }, [baseDate]);

    // --- Data Aggregation ---
    const allEvents = useMemo(() => {
        const events: ScheduleEvent[] = [];
        const todayStr = formatLocal(new Date());

        projects.forEach(project => {
            if (project.project_status === "已結案") return;

            project.steps.forEach(step => {
                // Focus on uncompleted steps with a current_planned_end
                if (step.status !== "完成" && !step.actual_end && step.current_planned_end) {
                    const targetDate = step.current_planned_end;
                    const daysDiff = getDaysDiff(todayStr, targetDate);
                    events.push({
                        id: `${project.project_id}-${step.id}`,
                        projectId: project.project_id,
                        projectName: project.project_name,
                        stepId: step.id,
                        stepName: step.name,
                        date: targetDate,
                        isDelayed: daysDiff < 0,
                        delayDays: daysDiff < 0 ? Math.abs(daysDiff) : 0,
                        daysUntilDue: daysDiff
                    });
                }
            });
        });
        return events;
    }, [projects]);

    // --- Sidebar Data ---
    const upcomingEvents = useMemo(() => {
        return allEvents
            .filter(e => !e.isDelayed && e.daysUntilDue >= 0 && e.daysUntilDue <= 14)
            .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    }, [allEvents]);

    const delayedEvents = useMemo(() => {
        return allEvents
            .filter(e => e.isDelayed)
            .sort((a, b) => b.delayDays - a.delayDays);
    }, [allEvents]);

    // --- Calendar Navigation ---
    const observerRef = useRef<IntersectionObserver | null>(null);
    const monthRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeTab !== "專案月曆") return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const intersectingEntry = entries.find(entry => entry.isIntersecting);
                if (intersectingEntry) {
                    const [yearStr, monthStr] = intersectingEntry.target.id.split("-").slice(1);
                    setActiveDate(new Date(parseInt(yearStr), parseInt(monthStr), 1));
                }
            },
            { root: containerRef.current, rootMargin: "-10% 0px -80% 0px", threshold: 0 }
        );

        monthRefs.current.forEach((el) => {
            if (el) observerRef.current?.observe(el);
        });

        return () => observerRef.current?.disconnect();
    }, [monthsRange, activeTab]);

    useEffect(() => {
        if (activeTab === "專案月曆") {
            const today = new Date();
            const id = `month-${today.getFullYear()}-${today.getMonth()}`;
            const el = monthRefs.current.get(id);
            if (el) {
                el.scrollIntoView({ block: 'start' });
            }
        }
    }, [activeTab]);

    const handleToday = () => {
        const today = new Date();
        const id = `month-${today.getFullYear()}-${today.getMonth()}`;
        const el = monthRefs.current.get(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const activeYear = activeDate.getFullYear();
    const activeMonth = activeDate.getMonth();

    return (
        <div className="w-full px-4 py-4 sm:px-6 h-[calc(100vh-3.5rem)] flex flex-col">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-4 gap-4 shrink-0">
                <div className="flex items-baseline gap-3">
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        {activeTab === "專案月曆" ? `${activeMonth + 1}月排程` : "今天跑哪"}
                    </h1>
                    {activeTab === "專案月曆" && (
                        <span className="text-zinc-500 font-medium dark:text-zinc-400">
                            {activeYear} 年 / {String(activeMonth + 1).padStart(2, '0')} 月
                        </span>
                    )}
                </div>
                {activeTab === "專案月曆" && (
                    <button onClick={handleToday} className="px-4 py-2 font-medium rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-800 dark:text-zinc-200">
                        回到本月
                    </button>
                )}
            </div>

            {/* Bookmark Tabs */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 mb-6 shrink-0">
                <div className="flex overflow-x-auto no-scrollbar">
                    {(["今天跑哪", "專案月曆"] as const).map(tab => (
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

                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 mb-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all font-bold shadow-sm"
                    title="Google 日曆同步設定"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="text-xs uppercase tracking-wider">Google 同步設定</span>
                </button>
            </div>

            <GoogleSyncSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onManualSync={() => {
                    fetchAllSchedules();
                }}
            />

            {activeTab === "今天跑哪" ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                    <WeeklyView
                        schedules={dbSchedules}
                        refreshSchedules={fetchAllSchedules}
                    />
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                    {/* Left: Continuous Calendar Month View (Scrollable Container) */}
                    <div className="flex-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col min-h-0">
                        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 shrink-0">
                            {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                                <div key={day} className="py-2 text-center text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Scrolling area */}
                        <div ref={containerRef} className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
                            {monthsRange.map(({ year, month }, mi) => {
                                const daysInMonth = getDaysInMonth(year, month);
                                const firstDay = getFirstDayOfMonth(year, month);
                                const calendarDays: { day: number | null, dateStr: string | null }[] = [];

                                for (let i = 0; i < firstDay; i++) {
                                    calendarDays.push({ day: null, dateStr: null });
                                }
                                for (let i = 1; i <= daysInMonth; i++) {
                                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                                    calendarDays.push({ day: i, dateStr });
                                }

                                return (
                                    <div
                                        key={`${year}-${month}`}
                                        id={`month-${year}-${month}`}
                                        ref={el => {
                                            if (el) monthRefs.current.set(`month-${year}-${month}`, el);
                                        }}
                                        className="border-b last:border-b-0 border-zinc-200 dark:border-zinc-800"
                                    >
                                        <div className="bg-zinc-50/80 dark:bg-zinc-800/80 px-4 py-2 text-sm font-bold text-zinc-800 dark:text-zinc-200 sticky top-0 z-10 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800/50">
                                            {year} 年 {month + 1} 月
                                        </div>
                                        <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)] divide-x divide-y divide-zinc-200 dark:divide-zinc-800 border-l mb-[1px] border-zinc-200 dark:border-zinc-800">
                                            {calendarDays.map((calDay, i) => {
                                                if (!calDay.day || !calDay.dateStr) return <div key={`empty-${mi}-${i}`} className="bg-zinc-50/50 dark:bg-zinc-900/20" />;

                                                const isToday = calDay.dateStr === formatLocal(new Date());
                                                const dayEvents = allEvents.filter(e => e.date === calDay.dateStr);
                                                const displayEvents = dayEvents.slice(0, 3);
                                                const moreCount = dayEvents.length - 3;

                                                return (
                                                    <div key={calDay.dateStr} className={`p-2 flex flex-col min-h-[120px] bg-white dark:bg-zinc-900 ${isToday ? 'bg-blue-50/10 dark:bg-blue-900/5 ring-1 ring-inset ring-blue-500/20 dark:ring-blue-500/10' : ''}`}>
                                                        <div className={`text-sm font-semibold mb-1 w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                                            {calDay.day}
                                                        </div>
                                                        <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
                                                            {displayEvents.map(ev => (
                                                                <div
                                                                    key={ev.id}
                                                                    className={`text-xs font-medium leading-tight px-1.5 py-1.5 rounded border overflow-hidden cursor-pointer transition-colors ${getEventColorStyle(ev.daysUntilDue)}`}
                                                                    title={`${ev.projectName}｜${ev.stepName}`}
                                                                    onMouseEnter={(e) => {
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        setHoveredEvent({ ev, x: rect.left + rect.width / 2, y: rect.bottom + 8 });
                                                                    }}
                                                                    onMouseLeave={() => setHoveredEvent(null)}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setHoveredEvent(null);
                                                                        router.push(`/projects?projectId=${ev.projectId}&open=1&layer=2&tab=flow&stepId=${ev.stepId}`);
                                                                    }}
                                                                >
                                                                    <div className="font-bold truncate">{ev.projectName}</div>
                                                                    <div className="truncate opacity-80">{ev.stepName}</div>
                                                                </div>
                                                            ))}
                                                            {moreCount > 0 && (
                                                                <button
                                                                    onClick={() => setSelectedDateEvents({ date: calDay.dateStr!, events: dayEvents })}
                                                                    className="w-full text-center text-[10px] font-bold text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 py-0.5 rounded transition-colors"
                                                                >
                                                                    + {moreCount} 筆
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Sidebar */}
                    <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0 h-full overflow-y-auto no-scrollbar">
                        {/* Delayed Events */}
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col shrink-0 min-h-[50%] max-h-[50%]">
                            <div className="bg-red-50 dark:bg-red-900/20 px-4 py-3 border-b border-red-100 dark:border-red-900/30 flex items-center justify-between shrink-0">
                                <h2 className="font-bold text-red-800 dark:text-red-400 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    已延遲項目
                                </h2>
                                <span className="bg-white text-red-600 border border-red-200 text-xs font-bold px-2 py-0.5 rounded-full dark:bg-red-900/40 dark:border-red-800 dark:text-red-300">
                                    {delayedEvents.length}
                                </span>
                            </div>
                            <div className="p-2 overflow-y-auto flex-1 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/30">
                                {delayedEvents.length === 0 ? (
                                    <div className="text-sm text-center py-6 text-zinc-500 dark:text-zinc-400">尚無延遲項目</div>
                                ) : (
                                    delayedEvents.map(ev => (
                                        <div key={ev.id} className="bg-white dark:bg-zinc-800 p-3 rounded-lg border border-red-100 dark:border-red-900/40 shadow-sm shrink-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-1" title={ev.projectName}>{ev.projectName}</div>
                                                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded dark:bg-red-900/30 dark:text-red-400 shrink-0">
                                                    逾期 {ev.delayDays} 天
                                                </span>
                                            </div>
                                            <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">{ev.stepName}</div>
                                            <div className="text-[10px] text-zinc-400">{ev.date}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Upcoming Events */}
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col shrink-0 min-h-[50%] max-h-[50%]">
                            <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between shrink-0">
                                <h2 className="font-bold text-blue-800 dark:text-blue-400 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    14 天內到期
                                </h2>
                                <span className="bg-white text-blue-600 border border-blue-200 text-xs font-bold px-2 py-0.5 rounded-full dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300">
                                    {upcomingEvents.length}
                                </span>
                            </div>
                            <div className="p-2 overflow-y-auto flex-1 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/30">
                                {upcomingEvents.length === 0 ? (
                                    <div className="text-sm text-center py-6 text-zinc-500 dark:text-zinc-400">尚無近期項目</div>
                                ) : (
                                    upcomingEvents.map(ev => (
                                        <div key={ev.id} className="bg-white dark:bg-zinc-800 p-3 rounded-lg border border-blue-100 dark:border-blue-900/40 shadow-sm shrink-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-1" title={ev.projectName}>{ev.projectName}</div>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${ev.daysUntilDue === 0 ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400' : 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                    {ev.daysUntilDue === 0 ? '今天' : `剩餘 ${ev.daysUntilDue} 天`}
                                                </span>
                                            </div>
                                            <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">{ev.stepName}</div>
                                            <div className="text-[10px] text-zinc-400">{ev.date}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hover Popover */}
            {hoveredEvent && !clickedEvent && !selectedDateEvents && (
                <div
                    className="fixed z-50 bg-white dark:bg-zinc-800 shadow-xl rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 w-64 pointer-events-none transform -translate-x-1/2 animate-in fade-in zoom-in-95 duration-150"
                    style={{ left: hoveredEvent.x, top: hoveredEvent.y }}
                >
                    <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1">{hoveredEvent.ev.date}</div>
                    <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-0.5">{hoveredEvent.ev.projectName}</div>
                    <div className="text-sm text-zinc-700 dark:text-zinc-300 mb-2">{hoveredEvent.ev.stepName}</div>
                    <div className={`text-xs font-bold px-2 py-1 rounded inline-block ${hoveredEvent.ev.daysUntilDue < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        hoveredEvent.ev.daysUntilDue <= 14 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}>
                        {getEventStatusText(hoveredEvent.ev)}
                    </div>
                </div>
            )}

            {/* Click Modal */}
            {clickedEvent && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm transition-opacity" onClick={() => setClickedEvent(null)} />
                    <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-800 flex flex-col animate-in fade-in zoom-in-95 duration-150">
                        <div className="mb-4 border-b border-zinc-100 pb-4 flex justify-between items-start dark:border-zinc-800 flex-none gap-4">
                            <div>
                                <div className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-1">{clickedEvent.date}</div>
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                                    {clickedEvent.projectName}
                                </h3>
                            </div>
                            <button onClick={() => setClickedEvent(null)} className="p-1 rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 shrink-0">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">節點名稱</div>
                                <div className="text-base text-zinc-900 dark:text-zinc-100 font-medium">{clickedEvent.stepName}</div>
                            </div>
                            <div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">狀態</div>
                                <div className={`text-sm font-bold px-2 py-1 rounded inline-block ${clickedEvent.daysUntilDue < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    clickedEvent.daysUntilDue <= 14 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    }`}>
                                    {getEventStatusText(clickedEvent)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Daily Events Modal */}
            {selectedDateEvents && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm transition-opacity" onClick={() => setSelectedDateEvents(null)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-800 flex flex-col max-h-[80vh]">
                        <div className="mb-4 border-b border-zinc-100 pb-3 flex justify-between items-center dark:border-zinc-800 flex-none">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                {selectedDateEvents.date} 待辦項目
                            </h3>
                            <button onClick={() => setSelectedDateEvents(null)} className="p-1 rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 space-y-2 pr-2">
                            {selectedDateEvents.events.map(ev => (
                                <div key={ev.id} className={`p-3 rounded-lg border ${ev.isDelayed ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900/40' : 'bg-zinc-50 border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-700'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{ev.projectName}</div>
                                        {ev.isDelayed && <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded dark:bg-red-900/50 dark:text-red-400">逾期 {ev.delayDays} 天</span>}
                                    </div>
                                    <div className={`text-xs ${ev.isDelayed ? 'text-red-700 dark:text-red-300' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                        {ev.stepName}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
