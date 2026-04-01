"use client";

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
        repair_status: string;
        address?: string | null;
        map_url?: string | null;
        site_contact_name?: string | null;
        site_contact_phone?: string | null;
        note?: string | null;
        source?: string;
    };
    onCreateReport: (ticket: any) => void;
}

export default function PendingMaintenanceCard({ ticket, onCreateReport }: PendingMaintenanceCardProps) {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between border-t-8 border-t-blue-500 overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-500/10 transition-colors"></div>
            
            <div>
                <div className="flex justify-between items-start mb-5 relative">
                    <div className="flex flex-col gap-1.5">
                        <span className={`text-base font-black px-4 py-2 rounded-2xl shadow-xl tracking-widest uppercase ${
                            ticket.repair_status === '待處理' 
                            ? 'bg-red-600 text-white shadow-red-500/20' 
                            : ticket.repair_status === '已完成'
                            ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                            : 'bg-zinc-800 text-white shadow-zinc-500/10'
                        }`}>
                            {ticket.repair_status}
                        </span>
                        {ticket.issue_tag && ticket.issue_tag !== '北區' && (
                            <span className="self-start text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                                {ticket.issue_tag}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md font-mono">{ticket.case_no || "N/A"}</span>
                    </div>
                </div>
                
                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 mb-4 leading-tight group-hover:text-blue-600 transition-colors" title={ticket.case_name}>
                    {ticket.case_name}
                </h3>
                
                <div className="grid grid-cols-1 gap-3 mb-6">
                    <a 
                        href={ticket.map_url || "#"} 
                        target={ticket.map_url ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        className={`flex items-start gap-3 text-sm transition-colors ${ticket.map_url ? 'text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 group/link' : 'text-zinc-400'}`}
                    >
                        <svg className={`w-4 h-4 mt-0.5 shrink-0 ${ticket.map_url ? 'text-blue-500 group-hover/link:scale-110 transition-transform' : 'text-zinc-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className={`break-words underline-offset-4 ${ticket.map_url ? 'hover:underline font-medium' : ''}`}>
                            {ticket.address || "尚無地址資訊"}
                        </span>
                    </a>
                    <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400 font-medium">
                        <svg className="w-4 h-4 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <span>{ticket.site_contact_name || "尚未關聯聯絡人"} {ticket.site_contact_phone ? `(${ticket.site_contact_phone})` : ""}</span>
                    </div>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="bg-zinc-50 dark:bg-black/40 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800/80 shadow-inner">
                        <div className="text-[10px] font-black text-zinc-400 uppercase mb-2 tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                            故障描述
                        </div>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed">
                            {ticket.issue_description || "尚無故障內容摘要"}
                        </p>
                    </div>

                    {ticket.note && (
                        <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/20 shadow-inner">
                            <div className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase mb-2 tracking-widest flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                                原始備註 (通訊錄)
                            </div>
                            <p className="text-sm text-amber-800/80 dark:text-amber-300/80 font-medium leading-relaxed whitespace-pre-wrap">
                                {ticket.note}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-5 mt-auto flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter">通報時間</span>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 font-bold">{ticket.report_time || "未知"}</span>
                </div>
                <button
                    onClick={() => onCreateReport(ticket)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-sm font-black transition-all active:scale-95 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 shadow-lg shadow-zinc-900/10 dark:shadow-none"
                >
                    維修回報
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
        </div>
    );
}
