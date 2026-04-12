"use client";

import { formatProjectName } from "../../../lib/utils/formatters";

interface PendingMaintenanceCardProps {
    ticket: {
        id: string;
        region: string;
        case_name: string;
        case_no: string;
        report_time: string;
        issue_summary: string;
        issue_tag?: string;
        issue_description?: string;
        monitor_staff?: string;
        monitor_judgement?: string;
        repair_staff?: string;
        repair_status: string;
        work_date?: string;
        complete_date?: string;
        address?: string | null;
        map_url?: string | null;
        site_contact_name?: string | null;
        site_contact_phone?: string | null;
        note?: string | null;
        source?: string;
        conflict_status?: string | null;
    };
    onCreateReport: (ticket: any) => void;
}

function getRepairStatusClass(status: string) {
    if (status === "待處理") {
        return "bg-red-600 text-white shadow-red-500/20";
    }

    if (status === "已完成") {
        return "bg-emerald-600 text-white shadow-emerald-500/20";
    }

    return "bg-zinc-800 text-white shadow-zinc-500/10";
}

export default function PendingMaintenanceCard({ ticket, onCreateReport }: PendingMaintenanceCardProps) {
    const formatted = formatProjectName(ticket.case_name);

    return (
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-t-8 border-t-blue-500 bg-white p-6 shadow-sm ring-1 ring-zinc-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-32 w-32 rounded-full bg-blue-500/5 blur-2xl transition-colors group-hover:bg-blue-500/10"></div>

            <div>
                <div className="relative mb-5 flex items-start justify-between">
                    <div className="flex flex-col gap-1.5">
                        <span
                            className={`rounded-2xl px-4 py-2 text-base font-black uppercase tracking-widest shadow-xl ${getRepairStatusClass(ticket.repair_status)}`}
                        >
                            {ticket.repair_status}
                        </span>

                        {ticket.issue_tag && ticket.issue_tag !== "北區" && (
                            <span className="self-start rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-400">
                                {ticket.issue_tag}
                            </span>
                        )}

                        {ticket.conflict_status === "needs_refresh" && (
                            <span className="self-start rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                資料已更新
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col items-end">
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs font-black text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                            {ticket.case_no || "N/A"}
                        </span>
                    </div>
                </div>

                <div className="group/title mb-4 flex flex-col gap-0.5">
                    {formatted.aux && formatted.aux !== formatted.region && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            {formatted.aux}
                        </span>
                    )}
                    <h3
                        className="text-xl font-black leading-tight text-zinc-900 transition-colors group-hover:text-blue-600 dark:text-zinc-50"
                        title={ticket.case_name}
                    >
                        {formatted.title}
                    </h3>
                </div>

                <div className="mb-6 grid grid-cols-1 gap-3">
                    <a
                        href={ticket.map_url || "#"}
                        target={ticket.map_url ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        className={`group/link flex items-start gap-3 text-sm transition-colors ${
                            ticket.map_url
                                ? "text-zinc-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
                                : "text-zinc-400"
                        }`}
                    >
                        <svg
                            className={`mt-0.5 h-4 w-4 shrink-0 ${
                                ticket.map_url ? "text-blue-500 transition-transform group-hover/link:scale-110" : "text-zinc-300"
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className={`break-words underline-offset-4 ${ticket.map_url ? "font-medium hover:underline" : ""}`}>
                            {ticket.address || "尚未補地址"}
                        </span>
                    </a>

                    <div className="flex items-center gap-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                        <svg className="h-4 w-4 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                        </svg>
                        <span>
                            {ticket.site_contact_name || "尚未補聯絡人"}
                            {ticket.site_contact_phone ? ` (${ticket.site_contact_phone})` : ""}
                        </span>
                    </div>
                </div>

                <div className="mb-6 space-y-4">
                    <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 shadow-inner dark:border-zinc-800/80 dark:bg-black/40">
                        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                            故障摘要
                        </div>
                        <p className="text-sm font-medium leading-relaxed text-zinc-700 dark:text-zinc-300">
                            {ticket.issue_description || "尚未提供故障描述"}
                        </p>
                        {(ticket.monitor_staff || ticket.monitor_judgement) && (
                            <div className="mt-3 border-t border-zinc-200/80 pt-3 text-xs font-bold text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                                {ticket.monitor_staff && <div>監控人員：{ticket.monitor_staff}</div>}
                                {ticket.monitor_judgement && <div className="mt-1">監控判斷：{ticket.monitor_judgement}</div>}
                            </div>
                        )}
                        {(ticket.repair_staff || ticket.work_date || ticket.complete_date) && (
                            <div className="mt-3 border-t border-zinc-200/80 pt-3 text-xs font-bold text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                                {ticket.repair_staff && <div>維修人員：{ticket.repair_staff}</div>}
                                {ticket.work_date && <div className="mt-1">施工日期：{ticket.work_date}</div>}
                                {ticket.complete_date && <div className="mt-1">完工日期：{ticket.complete_date}</div>}
                            </div>
                        )}
                    </div>

                    {ticket.note && (
                        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 shadow-inner dark:border-amber-900/20 dark:bg-amber-900/10">
                            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                備註
                            </div>
                            <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-amber-800/80 dark:text-amber-300/80">
                                {ticket.note}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-5 dark:border-zinc-800">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-tighter text-zinc-400">通報時間</span>
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                        {ticket.report_time || "未提供"}
                    </span>
                </div>

                <button
                    onClick={() => onCreateReport(ticket)}
                    className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-zinc-900/10 transition-all active:scale-95 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:shadow-none"
                >
                    建立回報
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
