"use client";

import React, { useState } from "react";
import * as actions from "../actions";
import InventoryMasterModal from "./InventoryMasterModal";
import InventoryTransactionModal from "./InventoryTransactionModal";
import InventoryLogsModal from "./InventoryLogsModal";

interface InventorySummaryItem {
    id: string;
    name: string;
    category: string;
    opening_qty: number;
    inbound_qty: number;
    outbound_qty: number;
    adjustment_qty: number;
    closing_qty: number;
    remarks?: string;
    is_active?: boolean;
}

interface InventorySummaryTableProps {
    data: InventorySummaryItem[];
    onRefresh: () => void;
    isReadOnly?: boolean;
    title?: string;
}

export default function InventorySummaryTable({ data, onRefresh, isReadOnly, title = "陽光庫存本月總表" }: InventorySummaryTableProps) {
    const [seExpanded, setSeExpanded] = useState(true);
    const [generalExpanded, setGeneralExpanded] = useState(true);
    const [emptyExpanded, setEmptyExpanded] = useState<Record<string, boolean>>({});


    // Modal States
    const [masterModal, setMasterModal] = useState({ isOpen: false, initialData: null as any });
    const [transactionModal, setTransactionModal] = useState({ isOpen: false, item: null as any, type: "inbound" as "inbound" | "adjustment" });
    const [logsModal, setLogsModal] = useState({ isOpen: false, item: null as any });

    // Check for error state from action (Moved after hooks to avoid "fewer hooks" error)
    if (data && (data as any).error) {
        const err = data as any;
        return (
            <div className="bg-red-50 dark:bg-red-900/10 border-2 border-red-100 dark:border-red-900/30 rounded-[2.5rem] p-10 text-center space-y-4">
                <div className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-red-500/20">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div>
                    <h3 className="text-xl font-black text-red-600 uppercase tracking-tight">庫存資料載入失敗</h3>
                    <p className="text-red-400 text-xs font-bold mt-2 font-mono break-all">{err.message || "Unknown Server Error"}</p>
                    {err.code && <p className="text-[10px] text-red-300 font-bold mt-1 uppercase tracking-widest">Error Code: {err.code}</p>}
                </div>
                <button onClick={onRefresh} className="px-6 py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95">
                    重新嘗試
                </button>
            </div>
        );
    }

    const categories = Array.from(new Set(data.map(i => i.category))).sort();

    const handleToggleActive = async (item: InventorySummaryItem) => {
        if (isReadOnly) return;
        try {
            if (item.is_active === false) {
                await actions.restoreItemAction(item.id);
            } else {
                await actions.softDeleteItemAction(item.id);
            }
            onRefresh();
        } catch (error) {
            alert("操作失敗");
        }
    };

    const renderSecondaryHeader = (title: string, isExpanded: boolean, onToggle: () => void, count: number, isEmptyGroup: boolean = false) => (
        <tr className={`${isEmptyGroup ? 'bg-zinc-50/20 dark:bg-zinc-900/40 opacity-70' : 'bg-zinc-100/50 dark:bg-zinc-800/50'} group cursor-pointer hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors`} onClick={onToggle}>
            <td colSpan={8} className="px-6 py-2.5 flex items-center justify-between">
                <span className={`text-xs font-black uppercase tracking-widest leading-none ${isEmptyGroup ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {title} ({count} 項)
                </span>
                <span className="text-zinc-400 group-hover:text-zinc-600 transition-colors">
                    {isExpanded ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                    )}
                </span>
            </td>
        </tr>
    );

    const renderRows = (items: InventorySummaryItem[]) => (
        items.map(item => (
            <tr
                key={item.id}
                className={`group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors font-medium border-b border-zinc-100 dark:border-zinc-800 last:border-0 ${item.is_active === false ? 'opacity-50 grayscale' : ''}`}
            >
                <td className="px-6 py-4 text-sm font-black text-zinc-900 dark:text-zinc-100">
                    <div className="flex flex-col">
                        <span>{item.name}</span>
                        {item.is_active === false && <span className="text-[9px] text-red-500 uppercase font-black tracking-widest">已停用 / 軟刪除</span>}
                    </div>
                </td>
                <td className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-tighter">{item.category}</td>

                {/* 數量欄位 - 唯讀 */}
                <td className="px-4 py-4 text-center text-sm font-black text-zinc-900 dark:text-zinc-100">
                    <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">{item.closing_qty}</span>
                </td>
                <td className="px-4 py-4 text-center text-sm font-black text-emerald-600">{item.inbound_qty || "0"}</td>
                <td className="px-4 py-4 text-center text-sm font-black text-red-600">{item.outbound_qty || "0"}</td>
                <td className="px-4 py-4 text-center text-sm font-black text-zinc-500">
                    <span className={`px-2 py-1 rounded-lg ${item.closing_qty < 0 ? "bg-red-500 text-white shadow-lg" : "bg-zinc-50 dark:bg-zinc-700"}`}>
                        {item.closing_qty}
                    </span>
                </td>

                <td className="px-6 py-4 text-xs italic text-zinc-400 line-clamp-1 max-w-[150px]" title={item.remarks}>
                    {item.remarks || "--"}
                </td>

                <td className="px-6 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => setMasterModal({ isOpen: true, initialData: item })}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                            title="編輯主檔"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button
                            onClick={() => setTransactionModal({ isOpen: true, item, type: "inbound" })}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                            title="新增入庫"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                        </button>
                        <button
                            onClick={() => setTransactionModal({ isOpen: true, item, type: "adjustment" })}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all"
                            title="庫存調整"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </button>
                        <button
                            onClick={() => setLogsModal({ isOpen: true, item })}
                            className="p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 rounded-lg transition-all"
                            title="查看異動紀錄"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        </button>
                        <button
                            onClick={() => handleToggleActive(item)}
                            className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all rounded-lg"
                            title="刪除品項"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </td>
            </tr>
        ))
    );

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 font-sans">
            <div className="px-8 py-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/30 dark:bg-white/[0.01]">
                <div>
                    <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-3">
                        <span className="w-2 h-7 bg-blue-600 rounded-full"></span>
                        {title}
                    </h2>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1 ml-5">Master Data & Transaction Protected</p>
                </div>
                {!isReadOnly && (
                    <button
                        onClick={() => setMasterModal({ isOpen: true, initialData: null })}
                        className="px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-zinc-500/10 flex items-center gap-2"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                        新增陽光庫存品項
                    </button>
                )}
            </div>

            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-zinc-50/50 dark:bg-zinc-800/20 text-zinc-400 dark:text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest">品項 / 型號</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-zinc-500 w-[12%] text-center">期初庫存</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-emerald-600 w-[12%] text-center">本月入庫</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-red-500 w-[12%] text-center">本月出庫</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-amber-500 w-[12%] text-center">盤點調整</th>
                            <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-blue-600 bg-blue-50/50 dark:bg-blue-900/10 w-[12%] text-center rounded-t-xl">本月結餘</th>
                            <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest">備註</th>
                            <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y-0">
                        {categories.map(category => {
                            const categoryItems = data.filter(i => i.category === category);
                            const emptyItems = categoryItems.filter(i =>
                                i.opening_qty === 0 &&
                                i.inbound_qty === 0 &&
                                i.outbound_qty === 0 &&
                                i.adjustment_qty === 0 &&
                                i.closing_qty === 0
                            );
                            const activeItems = categoryItems.filter(i => !emptyItems.includes(i));

                            const isExpanded = category === 'SE物料' ? seExpanded : generalExpanded;
                            const onToggle = category === 'SE物料' ? () => setSeExpanded(!seExpanded) : () => setGeneralExpanded(!generalExpanded);

                            const isEmptyExpanded = emptyExpanded[category] || false;
                            const onToggleEmpty = () => setEmptyExpanded(p => ({ ...p, [category]: !p[category] }));

                            return (
                                <React.Fragment key={category}>
                                    {activeItems.length > 0 && (
                                        <>
                                            {renderSecondaryHeader(`${category} - 正常顯示區`, isExpanded, onToggle, activeItems.length)}
                                            {isExpanded && renderRows(activeItems)}
                                        </>
                                    )}
                                    {emptyItems.length > 0 && (
                                        <>
                                            {renderSecondaryHeader(`未有庫存`, isEmptyExpanded, onToggleEmpty, emptyItems.length, true)}
                                            {isEmptyExpanded && renderRows(emptyItems)}
                                        </>
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {data.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-6 py-32 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-200">
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                        </div>
                                        <p className="text-zinc-400 font-bold italic text-sm tracking-widest">此月份尚無庫存資料</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Management Modals */}
            <InventoryMasterModal
                isOpen={masterModal.isOpen}
                onClose={() => setMasterModal({ ...masterModal, isOpen: false })}
                onSave={onRefresh}
                initialData={masterModal.initialData}
            />
            <InventoryTransactionModal
                isOpen={transactionModal.isOpen}
                onClose={() => setTransactionModal({ ...transactionModal, isOpen: false })}
                onSave={onRefresh}
                item={transactionModal.item}
                type={transactionModal.type}
            />
            <InventoryLogsModal
                isOpen={logsModal.isOpen}
                onClose={() => setLogsModal({ ...logsModal, isOpen: false })}
                item={logsModal.item}
            />
        </div>
    );
}
