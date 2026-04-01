"use client";

interface PendingMaintenanceListProps {
    tickets: any[];
    onCreateReport: (ticket: any) => void;
}

export default function PendingMaintenanceList({ tickets, onCreateReport }: PendingMaintenanceListProps) {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                            <th className="px-6 py-4">案場資訊</th>
                            <th className="px-6 py-4">地址 / 聯絡人</th>
                            <th className="px-6 py-4">故障摘要</th>
                            <th className="px-6 py-4">狀態</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {tickets.map(ticket => (
                            <tr key={ticket.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-[10px] text-zinc-400 font-mono font-bold">{ticket.case_no}</span>
                                    </div>
                                    <div className="font-black text-zinc-900 dark:text-zinc-50 text-sm group-hover:text-blue-600 transition-colors uppercase tracking-tight">{ticket.case_name}</div>
                                    <div className="text-[10px] text-zinc-400 mt-1 font-bold italic">通報: {ticket.report_time}</div>
                                </td>
                                <td className="px-6 py-5">
                                    <a 
                                        href={ticket.map_url || "#"} 
                                        target={ticket.map_url ? "_blank" : undefined}
                                        rel="noopener noreferrer"
                                        className={`text-xs block max-w-[200px] truncate underline-offset-4 hover:underline transition-all ${ticket.map_url ? 'text-zinc-600 dark:text-zinc-300 font-bold hover:text-blue-600' : 'text-zinc-400'}`} 
                                        title={ticket.address || ""}
                                    >
                                        {ticket.address || "尚無地址"}
                                    </a>
                                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1.5 font-bold flex items-center gap-1">
                                        <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        {ticket.site_contact_name || "未關聯"} {ticket.site_contact_phone ? `(${ticket.site_contact_phone})` : ""}
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    {ticket.issue_tag && (
                                        <div className="mb-1.5">
                                            <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                                                {ticket.issue_tag}
                                            </span>
                                        </div>
                                    )}
                                    <div className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-2 max-w-[250px] font-medium leading-relaxed" title={ticket.issue_description}>
                                        {ticket.issue_description || ticket.issue_summary}
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-center">
                                    <span className={`text-[11px] px-3.5 py-1.5 rounded-xl font-black uppercase tracking-widest shadow-lg ${
                                        ticket.repair_status === '待處理' 
                                        ? 'bg-red-600 text-white shadow-red-500/20' 
                                        : ticket.repair_status === '已完成'
                                        ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                                        : 'bg-zinc-800 text-white shadow-zinc-500/10'
                                    }`}>
                                        {ticket.repair_status}
                                    </span>
                                </td>
                                <td className="px-6 py-5 text-right">
                                    <button 
                                        onClick={() => onCreateReport(ticket)}
                                        className="inline-flex items-center gap-1 text-xs font-black text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:scale-105 transition-all p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                                    >
                                        維修回報
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
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
