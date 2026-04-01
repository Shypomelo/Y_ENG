"use client";

import React, { useState, useEffect } from "react";
import { InventoryItem } from "../../../lib/repositories/inventory";

interface ItemModalProps {
    isOpen: boolean;
    item?: InventoryItem;
    onClose: () => void;
    onSave: (item: Partial<InventoryItem>) => void;
    defaultCategory?: 'SE物料' | '一般用料';
}

export default function ItemModal({ isOpen, item, onClose, onSave, defaultCategory }: ItemModalProps) {
    const [name, setName] = useState("");
    const [category, setCategory] = useState<'SE物料' | '一般用料'>("SE物料");
    const [bucket, setBucket] = useState<'陽光庫存' | 'SE提供'>("陽光庫存");
    const [remarks, setRemarks] = useState("");

    useEffect(() => {
        if (item) {
            setName(item.name);
            setCategory(item.category as any);
            setBucket(item.bucket as any);
            setRemarks(item.remarks || "");
        } else {
            setName("");
            setCategory(defaultCategory || "SE物料");
            setBucket("陽光庫存");
            setRemarks("");
        }
    }, [item, isOpen, defaultCategory]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50">{item ? "編輯品項" : "新增品項"}</h2>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-black text-zinc-500 uppercase tracking-wider mb-1.5">品項名稱 / 型號</label>
                        <input 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="例如：SE3000H-RW000BEN4備機"
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-zinc-500 uppercase tracking-wider mb-1.5">類別</label>
                            <select 
                                value={category}
                                onChange={(e) => setCategory(e.target.value as any)}
                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="SE物料">SE物料</option>
                                <option value="一般用料">一般用料</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-zinc-500 uppercase tracking-wider mb-1.5">來源庫別</label>
                            <select 
                                value={bucket}
                                onChange={(e) => setBucket(e.target.value as any)}
                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="陽光庫存">陽光庫存</option>
                                <option value="SE提供">SE提供</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-black text-zinc-500 uppercase tracking-wider mb-1.5">備註</label>
                        <textarea 
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                        />
                    </div>
                </div>
                
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                    >
                        取消
                    </button>
                    <button 
                        onClick={() => onSave({ name, category, bucket, remarks, id: item?.id })}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700 transition-all shadow-lg"
                    >
                        儲存項目
                    </button>
                </div>
            </div>
        </div>
    );
}
