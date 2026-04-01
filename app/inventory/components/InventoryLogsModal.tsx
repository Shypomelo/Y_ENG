"use client";

import { useState, useEffect } from "react";
import * as actions from "../actions";

interface InventoryLogsModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: { id: string; name: string } | null;
}

export default function InventoryLogsModal({ isOpen, onClose, item }: InventoryLogsModalProps) {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen && item) {
            fetchLogs();
        }
    }, [isOpen, item]);

    const fetchLogs = async () => {
        if (!item) return;
        setIsLoading(true);
        try {
            const data = await actions.getItemLogsAction(item.id);
            setLogs(data || []);
        } catch (error) {
            console.error("Failed to fetch logs:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
                <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-white/[0.02] shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">庫存異動紀錄</h2>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Item History: <span className="text-blue-500">{item.name}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                            <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Loading History...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
                            <svg className="w-12 h-12 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                            <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">No transaction history found</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {logs.map((log) => (
                                <div key={log.id} className="group flex items-center justify-between p-5 bg-zinc-50 dark:bg-zinc-800/40 rounded-[1.5rem] border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-all">
                                    <div className="flex items-center gap-5">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm ${
                                            log.type === '入庫' ? 'bg-emerald-500/10 text-emerald-600' :
                                            log.type === '正式出庫' ? 'bg-red-500/10 text-red-600' :
                                            'bg-amber-500/10 text-amber-600'
                                        }`}>
                                            {log.type === '入庫' ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg> :
                                             log.type === '正式出庫' ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg> :
                                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-zinc-900 dark:text-zinc-50">{log.type}</span>
                                                <span className="text-[10px] font-black text-zinc-400 px-2 py-0.5 bg-zinc-200/50 dark:bg-zinc-700/50 rounded-full uppercase tracking-tighter">{log.date}</span>
                                            </div>
                                            <div className="mt-1 text-xs font-bold text-zinc-500 line-clamp-1">{log.remarks || (log.case_name ? `用於: ${log.case_name}` : "無備註")}</div>
                                            {log.reason && <div className="mt-1 text-[9px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-md inline-block">Reason: {log.reason}</div>}
                                        </div>
                                    </div>
                                    <div className={`text-lg font-black tabular-nums ${log.qty_change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {log.qty_change > 0 ? `+${log.qty_change}` : log.qty_change}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-8 py-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 shrink-0">
                    <button 
                        onClick={onClose}
                        className="w-full px-6 py-4 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all active:scale-95"
                    >
                        關閉視窗
                    </button>
                </div>
            </div>
        </div>
    );
}
