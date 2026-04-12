"use client";

interface PendingMaintenanceListProps {
    tickets: any[];
    onCreateReport: (ticket: any) => void;
}

function getRepairStatusClass(status: string) {
    if (status === "待處理") {
        return "bg-red-600 text-white shadow-red-500/20";
    }

    if (status === "已處理") {
        return "bg-emerald-600 text-white shadow-emerald-500/20";
    }

    return "bg-zinc-800 text-white shadow-zinc-500/10";
}

export default function PendingMaintenanceList({ tickets, onCreateReport }: PendingMaintenanceListProps) {
    return (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                    <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50">
                            <th className="px-6 py-4">案件</th>
                            <th className="px-6 py-4">地址 / 聯絡人</th>
                            <th className="px-6 py-4">故障摘要</th>
                            <th className="px-6 py-4">狀態</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {tickets.map((ticket) => (
                            <tr key={ticket.id} className="group transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                                <td className="px-6 py-5">
                                    <div className="mb-1.5 flex items-center gap-2">
                                        <span className="font-mono text-[10px] font-bold text-zinc-400">{ticket.case_no}</span>
                                        {ticket.conflict_status === "needs_refresh" && (
                                            <span 
                                                className="cursor-help rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-black tracking-widest text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                                title="外部系統的資料有變更，請確認最新狀態"
                                            >
                                                資料已更新
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm font-black uppercase tracking-tight text-zinc-900 transition-colors group-hover:text-blue-600 dark:text-zinc-50">
                                        {ticket.case_name}
                                    </div>
                                    <div className="mt-1 text-[10px] font-bold italic text-zinc-400">
                                        通報時間: {ticket.report_time}
                                    </div>
                                </td>

                                <td className="px-6 py-5">
                                    <a
                                        href={ticket.map_url || "#"}
                                        target={ticket.map_url ? "_blank" : undefined}
                                        rel="noopener noreferrer"
                                        className={`block max-w-[200px] truncate text-xs underline-offset-4 transition-all hover:underline ${
                                            ticket.map_url
                                                ? "font-bold text-zinc-600 hover:text-blue-600 dark:text-zinc-300"
                                                : "text-zinc-400"
                                        }`}
                                        title={ticket.address || ""}
                                    >
                                        {ticket.address || "尚未補地址"}
                                    </a>
                                    <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                                        <svg className="h-3 w-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={3}
                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                            />
                                        </svg>
                                        {ticket.site_contact_name || "尚未補聯絡人"}
                                        {ticket.site_contact_phone ? ` (${ticket.site_contact_phone})` : ""}
                                    </div>
                                </td>

                                <td className="px-6 py-5">
                                    {ticket.issue_tag && (
                                        <div className="mb-1.5">
                                            <span className="rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-400">
                                                {ticket.issue_tag}
                                            </span>
                                        </div>
                                    )}
                                    <div
                                        className="line-clamp-2 max-w-[250px] text-xs font-medium leading-relaxed text-zinc-700 dark:text-zinc-300"
                                        title={ticket.issue_description}
                                    >
                                        {ticket.issue_description || ticket.issue_summary}
                                    </div>
                                    {(ticket.monitor_staff || ticket.monitor_judgement) && (
                                        <div className="mt-2 space-y-1 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                                            {ticket.monitor_staff && <div>監控人員：{ticket.monitor_staff}</div>}
                                            {ticket.monitor_judgement && <div>監控判斷：{ticket.monitor_judgement}</div>}
                                        </div>
                                    )}
                                </td>

                                <td className="px-6 py-5 text-center">
                                    <span
                                        className={`rounded-xl px-3.5 py-1.5 text-[11px] font-black uppercase tracking-widest shadow-lg ${getRepairStatusClass(ticket.repair_status)}`}
                                    >
                                        {ticket.repair_status}
                                    </span>
                                    {(ticket.repair_staff || ticket.work_date || ticket.complete_date) && (
                                        <div className="mt-2 space-y-1 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                                            {ticket.repair_staff && <div>維修：{ticket.repair_staff}</div>}
                                            {ticket.work_date && <div>施工：{ticket.work_date}</div>}
                                            {ticket.complete_date && <div>完工：{ticket.complete_date}</div>}
                                        </div>
                                    )}
                                </td>

                                <td className="px-6 py-5 text-right">
                                    <button
                                        onClick={() => onCreateReport(ticket)}
                                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 p-2 text-xs font-black text-blue-600 transition-all hover:scale-105 hover:text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                                    >
                                        建立回報
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
