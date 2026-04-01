"use client";

import React, { useState } from "react";

interface ReconciliationItem {
    id: string;
    report_id: string;
    case_name: string;
    case_no: string;
    report_date: string;
    engineer_names: string;
    item_name_snapshot: string;
    qty: number;
    source_bucket: string;
    remark: string;
    status: string;
}

interface SimpleReconciliationProps {
    reports: ReconciliationItem[];
    onConfirm: (id: string) => void;
}

export default function SimpleReconciliation({ reports, onConfirm }: SimpleReconciliationProps) {
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    if (reports.length === 0) return null;

    // Group items by report_id
    const grouped = reports.reduce((acc, item) => {
        if (!acc[item.report_id]) acc[item.report_id] = [];
        acc[item.report_id].push(item);
        return acc;
    }, {} as Record<string, ReconciliationItem[]>);

    const handleConfirm = async (id: string) => {
        setIsProcessing(id);
        try {
            await onConfirm(id);
        } finally {
            setIsProcessing(null);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3 px-2">
                <div className="w-2 h-8 bg-amber-500 rounded-full"></div>
                <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-4">
                    待核對維修項目
                    <span className="text-sm font-black bg-amber-100 text-amber-600 px-3 py-1 rounded-full uppercase tracking-widest">{reports.length} 筆待處理料件</span>
                </h2>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {Object.entries(grouped).map(([reportId, items]) => (
                    <div key={reportId} className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xl hover:border-amber-400/50 transition-all duration-300">
                        {/* Header */}
                        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex justify-between items-center">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">{items[0].case_name}</h3>
                                    <span className="text-[10px] font-mono text-zinc-400 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-zinc-100 dark:border-zinc-800">{items[0].case_no}</span>
                                </div>
                                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">
                                    核對日期: {items[0].report_date} | 維修人員: {items[0].engineer_names}
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-zinc-50/30 dark:bg-transparent border-b border-zinc-100 dark:border-zinc-800">
                                        <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">料件名稱</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">數量</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">來源</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">備註</th>
                                        <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">核對</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                                    {items.map((item) => (
                                        <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.01] transition-colors">
                                            <td className="px-8 py-5">
                                                <div className="font-black text-sm text-zinc-800 dark:text-zinc-200">{item.item_name_snapshot}</div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="font-black text-blue-600 dark:text-blue-400">{item.qty}</div>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${
                                                    item.source_bucket === 'SE提供' 
                                                        ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' 
                                                        : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                }`}>
                                                    {item.source_bucket}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="text-xs text-zinc-400 font-bold truncate max-w-[200px]" title={item.remark}>{item.remark || "-"}</div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button 
                                                    onClick={() => handleConfirm(item.id)}
                                                    disabled={isProcessing === item.id}
                                                    className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-xl text-[10px] font-black shadow-lg shadow-zinc-500/10 active:scale-95 disabled:opacity-30 flex items-center justify-center gap-2 group ml-auto"
                                                >
                                                    {isProcessing === item.id ? (
                                                        <div className="w-3 h-3 border-2 border-zinc-400 border-t-transparent animate-spin rounded-full"></div>
                                                    ) : (
                                                        <svg className="w-3.5 h-3.5 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                    )}
                                                    確認出庫
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
