"use client";

import React, { useState, useEffect } from "react";
import { InventoryItem } from "../../../lib/repositories/inventory";

interface UsageEditModalProps {
    isOpen: boolean;
    log: any;
    items: InventoryItem[];
    onClose: () => void;
    onSave: (id: string, updates: any) => void;
}

export default function UsageEditModal({ isOpen, log, items, onClose, onSave }: UsageEditModalProps) {
    const [itemId, setItemId] = useState("");
    const [qty, setQty] = useState(0);
    const [remarks, setRemarks] = useState("");
    const [date, setDate] = useState("");

    useEffect(() => {
        if (log) {
            setItemId(log.item_id || "");
            setQty(log.qty || 0);
            setRemarks(log.remarks || "");
            setDate(log.date || "");
        }
    }, [log, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between font-black text-zinc-900 dark:text-zinc-50">
                    <h2 className="text-xl tracking-tight">修正使用明細</h2>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="p-6 space-y-5">
                    <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                        <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">對應案場</div>
                        <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">{log.case_name || "未知案場"}</div>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-zinc-500 uppercase tracking-wider mb-1.5">品項</label>
                        <select 
                            value={itemId}
                            onChange={(e) => setItemId(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {items.map(item => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-zinc-500 uppercase tracking-wider mb-1.5">數量</label>
                            <input 
                                type="number" 
                                value={qty}
                                onChange={(e) => setQty(Number(e.target.value))}
                                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-zinc-500 uppercase tracking-wider mb-1.5">日期</label>
                            <input 
                                type="date" 
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-black text-zinc-500 uppercase tracking-wider mb-1.5">備註</label>
                        <textarea 
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                        />
                    </div>
                </div>
                
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-black text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all uppercase tracking-widest"
                    >
                        取消
                    </button>
                    <button 
                        onClick={() => onSave(log.id, { item_id: itemId, qty, remarks, date })}
                        className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 uppercase tracking-widest"
                    >
                        儲存修正
                    </button>
                </div>
            </div>
        </div>
    );
}
