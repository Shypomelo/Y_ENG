"use client";

import { useState } from "react";
import * as actions from "../actions";

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

interface ReconciliationTabProps {
    items: ReconciliationItem[];
    onRefresh: () => void;
}

export default function ReconciliationTab({ items, onRefresh }: ReconciliationTabProps) {
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [returnReason, setReturnReason] = useState("");
    const [activeReturnId, setActiveReturnId] = useState<string | null>(null);

    const handleConfirm = async (id: string) => {
        setIsProcessing(id);
        try {
            await actions.confirmReconciliationAction(id);
            onRefresh();
        } catch (error: any) {
            alert("確認失敗: " + error.message);
        } finally {
            setIsProcessing(null);
        }
    };

    const handleReturn = async (reportId: string) => {
        if (!returnReason.trim()) {
            alert("請填寫退回原因");
            return;
        }
        setIsProcessing(reportId);
        try {
            await actions.returnReconciliationAction(reportId, returnReason);
            setActiveReturnId(null);
            setReturnReason("");
            onRefresh();
        } catch (error: any) {
            alert("退回失敗: " + error.message);
        } finally {
            setIsProcessing(null);
        }
    };

    if (items.length === 0) {
        return (
            <div className="py-20 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[3rem] text-zinc-400 font-black uppercase tracking-widest text-xs">
                目前尚無待核對的維修料件
            </div>
        );
    }

    // Group items by report_id to show them together
    const grouped = items.reduce((acc, item) => {
        if (!acc[item.report_id]) acc[item.report_id] = [];
        acc[item.report_id].push(item);
        return acc;
    }, {} as Record<string, ReconciliationItem[]>);

    return (
        <div className="space-y-8">
            {Object.entries(grouped).map(([reportId, reportItems]) => (
                <div key={reportId} className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] shadow-xl overflow-hidden hover:border-blue-500/30 transition-all">
                    <div className="px-8 py-6 bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-3">
                                <h4 className="font-black text-lg text-zinc-900 dark:text-zinc-100">{reportItems[0].case_name}</h4>
                                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{reportItems[0].case_no}</span>
                            </div>
                            <div className="text-[10px] text-zinc-400 font-bold mt-1 uppercase tracking-widest">
                                報告日期: {reportItems[0].report_date} | 維修人員: {reportItems[0].engineer_names}
                            </div>
                        </div>
                        <div className="flex gap-3">
                            {activeReturnId === reportId ? (
                                <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                                    <input 
                                        type="text" 
                                        placeholder="退回原因..." 
                                        value={returnReason}
                                        onChange={e => setReturnReason(e.target.value)}
                                        className="bg-white dark:bg-zinc-800 border border-red-200 dark:border-red-900/50 rounded-xl px-4 py-2 text-xs font-bold outline-none ring-2 ring-red-500/10 w-64"
                                    />
                                    <button 
                                        onClick={() => handleReturn(reportId)}
                                        disabled={isProcessing === reportId}
                                        className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-red-500/20 active:scale-95"
                                    >
                                        確認退回
                                    </button>
                                    <button onClick={() => setActiveReturnId(null)} className="text-zinc-400 hover:text-zinc-900 p-2">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setActiveReturnId(reportId)}
                                    className="px-6 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl text-xs font-black hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
                                >
                                    退回
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="p-0">
                        <table className="w-full text-left">
                            <thead className="bg-zinc-50/30 dark:bg-transparent">
                                <tr className="border-b border-zinc-50 dark:border-zinc-800">
                                    <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">更換料件</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">數量</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">來源</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">備註</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">核對</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                                {reportItems.map((item) => (
                                    <tr key={item.id} className="group hover:bg-zinc-50/50 dark:hover:bg-white/[0.01] transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="font-black text-sm text-zinc-800 dark:text-zinc-200">{item.item_name_snapshot}</div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="font-black text-blue-600 dark:text-blue-400">{item.qty}</div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${
                                                item.source_bucket === 'SE提供' 
                                                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' 
                                                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
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
                                                className="bg-white dark:bg-zinc-800 p-2 rounded-xl text-emerald-500 border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 shadow-sm transition-all active:scale-95 disabled:opacity-30"
                                            >
                                                {isProcessing === item.id ? (
                                                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent animate-spin rounded-full"></div>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                )}
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
    );
}
