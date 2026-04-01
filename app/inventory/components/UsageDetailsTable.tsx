"use client";

import React from "react";

interface UsageLog {
    id: string;
    date: string;
    case_name?: string;
    item?: { name: string; category: string };
    item_id: string;
    qty: number;
    bucket: string;
    status: string; // 待確認, 已確認, 已封存
    remarks?: string;
    report_id?: string;
    treatment_name?: string;
}

interface UsageDetailsTableProps {
    logs: any[];
    onDelete: (id: string) => void;
    onFinalize: (id: string) => void;
    isReadOnly?: boolean;
}

export default function UsageDetailsTable({ logs, onDelete, onFinalize, isReadOnly }: UsageDetailsTableProps) {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xl border-t-8 border-t-blue-600 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
            <div className="px-8 py-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/10">
                <div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-3">
                        使用明細核對區
                        {isReadOnly && <span className="text-[10px] px-3 py-1 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200 font-black uppercase tracking-widest">歷史封存檔</span>}
                    </h2>
                    <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-1">使用明細與扣庫紀錄</p>
                </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-zinc-50/50 dark:bg-zinc-800/20 text-zinc-400 dark:text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest">日期</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest">案場 / 維修來源</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest">處理項目</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest">使用品項</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">來源</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">數量</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">狀態</th>
                            <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                        {logs.map(log => (
                            <tr key={log.id} className="hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-all group">
                                <td className="px-8 py-5 text-xs font-black text-zinc-400 whitespace-nowrap uppercase tracking-tighter">{log.date}</td>
                                <td className="px-6 py-5">
                                    <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">{log.case_name || "-"}</div>
                                    {log.report_id && (
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="text-[8px] bg-zinc-900 text-white px-1.5 py-0.5 rounded font-black uppercase">Report</span>
                                            <span className="text-[9px] text-zinc-400 font-mono tracking-tighter">#{log.report_id.substring(0, 8)}</span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-5">
                                    <div className="text-xs font-black text-zinc-500 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-100 dark:border-zinc-700 inline-block">
                                        {log.treatment_name || "一般維運"}
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="text-sm font-black text-blue-600 dark:text-blue-400">{log.item?.name || log.item_name || "未知品項"}</div>
                                    {log.remarks && (
                                        <div className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1 italic">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                                            {log.remarks}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-5 text-center">
                                    <span className={`text-[9px] font-black px-2 py-1 rounded-md border ${log.bucket === 'SE提供'
                                            ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/50'
                                            : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/50'
                                        }`}>
                                        {log.bucket}
                                    </span>
                                </td>
                                <td className="px-6 py-5 text-center font-black text-lg text-zinc-900 dark:text-zinc-50">{log.qty}</td>
                                <td className="px-6 py-5 text-center">
                                    <span className={`text-[9px] font-black px-3 py-1.5 rounded-full border shadow-sm transition-all ${log.status === '待確認' ? 'bg-amber-100/50 text-amber-700 border-amber-200 animate-pulse' :
                                            log.status === '已確認' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                'bg-zinc-100 text-zinc-400 border-zinc-200 opacity-60'
                                        }`}>
                                        {log.status}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-right">
                                    {!isReadOnly && log.status !== '已封存' && (
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                            {log.status === '待確認' && (
                                                <button
                                                    onClick={() => onFinalize(log.id)}
                                                    className="text-[10px] font-black px-4 py-2 rounded-xl bg-blue-600 text-white shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-widest"
                                                >
                                                    核對並扣庫
                                                </button>
                                            )}
                                            <button
                                                onClick={() => onDelete(log.id)}
                                                className="p-2.5 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                                title="刪除"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-40 text-center">
                                    <div className="flex flex-col items-center gap-4 opacity-20">
                                        <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                        <p className="text-zinc-500 font-black uppercase tracking-[0.3em] text-sm italic">尚無核對明細</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
