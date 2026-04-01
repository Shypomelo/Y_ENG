"use client";

import React, { useState } from "react";
import { InventoryItem } from "../../../lib/repositories/inventory";

interface InboundModalProps {
    isOpen: boolean;
    items: InventoryItem[];
    onClose: () => void;
    onSave: (data: { item_id: string; date: string; qty: number; remarks: string }) => void;
    onCreateItemAndInbound: (itemData: Partial<InventoryItem>, inboundData: { date: string; qty: number; remarks: string }) => void;
}

export default function InboundModal({ isOpen, items, onClose, onSave, onCreateItemAndInbound }: InboundModalProps) {
    const [mode, setMode] = useState<'select' | 'create'>('select');
    
    // Select Mode Fields
    const [itemId, setItemId] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [qty, setQty] = useState(0);
    const [remarks, setRemarks] = useState("");

    // Create Mode Fields
    const [newItemName, setNewItemName] = useState("");
    const [newItemCategory, setNewItemCategory] = useState<'SE物料' | '一般用料'>('一般用料');
    const [newItemRemarks, setNewItemRemarks] = useState("");

    if (!isOpen) return null;

    const resetFields = () => {
        setItemId("");
        setQty(0);
        setRemarks("");
        setNewItemName("");
        setNewItemCategory('一般用料');
        setNewItemRemarks("");
        setMode('select');
    };

    const handleConfirm = () => {
        if (mode === 'select') {
            if (itemId && qty > 0) {
                onSave({ item_id: itemId, date, qty, remarks });
                resetFields();
            }
        } else {
            if (newItemName && qty > 0) {
                onCreateItemAndInbound(
                    { name: newItemName, category: newItemCategory, remarks: newItemRemarks, bucket: '陽光庫存' },
                    { date, qty, remarks }
                );
                resetFields();
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-300 font-sans">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/30">
                    <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                        {mode === 'select' ? '新增入庫紀錄' : '✨ 新增品項並入庫'}
                    </h2>
                    <button onClick={() => { onClose(); resetFields(); }} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* Mode Toggle */}
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl">
                        <button 
                            onClick={() => setMode('select')}
                            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${mode === 'select' ? 'bg-white dark:bg-zinc-900 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            現有品項入庫
                        </button>
                        <button 
                            onClick={() => setMode('create')}
                            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${mode === 'create' ? 'bg-white dark:bg-zinc-900 text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            + 開發新案/新增品項
                        </button>
                    </div>

                    {mode === 'select' ? (
                        <div>
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">入庫品項</label>
                            <select 
                                value={itemId}
                                onChange={(e) => setItemId(e.target.value)}
                                className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none"
                            >
                                <option value="">請點選現有品項...</option>
                                <optgroup label="SE物料">
                                    {items.filter(i => i.category === 'SE物料').map(item => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="一般用料">
                                    {items.filter(i => i.category === '一般用料').map(item => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">新編號 / 型號</label>
                                <input 
                                    type="text" 
                                    placeholder="輸入新物料名稱或型號"
                                    value={newItemName}
                                    onChange={(e) => setNewItemName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm font-black focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">分類</label>
                                <div className="flex gap-2">
                                    {['一般用料', 'SE物料'].map((cat) => (
                                        <button 
                                            key={cat}
                                            onClick={() => setNewItemCategory(cat as any)}
                                            className={`flex-1 py-2 text-[10px] font-black border rounded-xl transition-all ${
                                                newItemCategory === cat 
                                                ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                                                : 'border-zinc-200 text-zinc-400 hover:bg-zinc-50'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">品項備註</label>
                                <input 
                                    type="text" 
                                    placeholder="例如：特定容量、品牌標註"
                                    value={newItemRemarks}
                                    onChange={(e) => setNewItemRemarks(e.target.value)}
                                    className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm font-bold outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">入庫量</label>
                            <input 
                                type="number" 
                                value={qty}
                                onChange={(e) => setQty(Number(e.target.value))}
                                className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm font-black focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">日期</label>
                            <input 
                                type="date" 
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">此筆入庫備註</label>
                        <textarea 
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="採購編號、出貨單號或是盤點補入..."
                            className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all min-h-[60px]"
                        />
                    </div>
                </div>
                
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 flex gap-3 bg-zinc-50/10">
                    <button 
                        onClick={() => { onClose(); resetFields(); }}
                        className="flex-1 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs font-black text-zinc-500 hover:bg-zinc-50 transition-all uppercase tracking-widest"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={mode === 'select' ? (!itemId || qty <= 0) : (!newItemName || qty <= 0)}
                        className={`flex-1 py-3 rounded-2xl text-white text-xs font-black transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none uppercase tracking-widest ${mode === 'select' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'}`}
                    >
                        {mode === 'select' ? '確認入庫' : '確認創立並入庫'}
                    </button>
                </div>
            </div>
        </div>
    );
}
