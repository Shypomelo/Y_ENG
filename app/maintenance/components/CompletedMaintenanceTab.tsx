"use client";

import { useMemo } from "react";
import { MaintenanceReport } from "../../../lib/types/database";

interface CompletedMaintenanceTabProps {
    reports: MaintenanceReport[];
    onEdit: (report: MaintenanceReport) => void;
}

export default function CompletedMaintenanceTab({ reports, onEdit }: CompletedMaintenanceTabProps) {
    // Filter only confirmed reports
    const confirmedReports = useMemo(() => {
        return reports.filter(r => r.workflow_state === 'confirmed');
    }, [reports]);

    if (confirmedReports.length === 0) {
        return (
            <div className="py-20 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[3rem] text-zinc-400 font-black uppercase tracking-widest text-xs">
                尚無已完成維修紀錄
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                            <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">案場資訊</th>
                            <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">維修項目 / 用料</th>
                            <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">維修人員</th>
                            <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">完成日期</th>
                            <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                        {confirmedReports.map(report => {
                            const metadata = report.metadata as any;
                            const treatments = metadata?.treatment_items || [];
                            let sunshineParts = 0;
                            let seParts = 0;
                            
                            treatments.forEach((t: any) => {
                                (t.parts || []).forEach((p: any) => {
                                    if (p.source_bucket === 'SE提供') seParts++;
                                    else sunshineParts++; // Default to sunshine if not specified
                                });
                            });

                            return (
                                <tr key={report.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.01] transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="font-black text-zinc-900 dark:text-zinc-100">{report.case_name}</div>
                                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{report.case_no || "無案號"}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                            {treatments.length > 0 ? treatments[0].name : (report.repair_item || "未列出")}
                                            {treatments.length > 1 && <span className="text-zinc-400 text-[10px] ml-1">等 {treatments.length} 項</span>}
                                        </div>
                                        <div className="flex gap-2 mt-1.5 flex-wrap">
                                            {sunshineParts > 0 && (
                                                <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[9px] font-black px-2 py-0.5 rounded uppercase">
                                                    陽光庫存: {sunshineParts}
                                                </span>
                                            )}
                                            {seParts > 0 && (
                                                <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[9px] font-black px-2 py-0.5 rounded uppercase">
                                                    SE提供: {seParts}
                                                </span>
                                            )}
                                            {sunshineParts === 0 && seParts === 0 && (
                                                <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-[9px] font-black px-2 py-0.5 rounded uppercase">
                                                    無零件更換
                                                </span>
                                            )}
                                            {report.reconciled_at && (
                                                <span className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded uppercase">與庫存一致</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="text-xs font-bold text-zinc-500">{report.repair_staff || "-"}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="text-xs font-mono font-bold text-zinc-400">
                                            {report.completed_at ? report.completed_at.split('T')[0] : "-"}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <button 
                                            onClick={() => onEdit(report)}
                                            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-xl text-[10px] font-black hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 transition-all active:scale-95 uppercase tracking-widest"
                                        >
                                            檢視
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
