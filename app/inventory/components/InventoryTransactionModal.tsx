"use client";

import { useState, useEffect } from "react";
import * as actions from "../actions";

interface InventoryTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    item: { id: string; name: string } | null;
    type: "inbound" | "adjustment";
}

export default function InventoryTransactionModal({ isOpen, onClose, onSave, item, type }: InventoryTransactionModalProps) {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        qty: "",
        reason: "補登入庫",
        remarks: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData({
                date: new Date().toISOString().split('T')[0],
                qty: "",
                reason: type === "adjustment" ? "盤點修正" : "補登入庫",
                remarks: ""
            });
        }
    }, [isOpen, type]);

    if (!isOpen || !item) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numQty = parseFloat(formData.qty);
        if (isNaN(numQty) || numQty === 0) {
            alert("請輸入有效的數量");
            return;
        }

        setIsSubmitting(true);
        try {
            if (type === "inbound") {
                await actions.addInboundLogAction({
                    item_id: item.id,
                    date: formData.date,
                    qty: numQty,
                    remarks: formData.remarks
                });
            } else {
                await actions.addAdjustmentLogAction({
                    item_id: item.id,
                    date: formData.date,
                    qty: numQty,
                    reason: formData.reason,
                    remarks: formData.remarks
                });
            }
            onSave();
            onClose();
        } catch (error: any) {
            console.error("Transaction failed:", error);
            alert(error.message || "儲存失敗，請檢查網路或系統狀態");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-white/[0.02]">
                    <div>
                        <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                            {type === "inbound" ? "陽光庫存 - 新增入庫" : "陽光庫存 - 庫存調整"}
                        </h2>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">
                            Item: <span className="text-blue-500">{item.name}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">異動日期</label>
                            <input 
                                type="date" required
                                value={formData.date}
                                onChange={(e) => setFormData({...formData, date: e.target.value})}
                                className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">
                                {type === "inbound" ? "入庫數量" : "調整數量 (可帶負號)"}
                            </label>
                            <input 
                                type="number" step="any" required
                                value={formData.qty}
                                onChange={(e) => setFormData({...formData, qty: e.target.value})}
                                className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm"
                                placeholder={type === "inbound" ? "例如：10" : "例如：-3 或 5"}
                            />
                        </div>
                    </div>

                    {type === "adjustment" && (
                        <div>
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">調整原因</label>
                            <select 
                                value={formData.reason}
                                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                                className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm appearance-none"
                            >
                                <option value="補登入庫">補登入庫</option>
                                <option value="盤點修正">盤點修正</option>
                                <option value="報廢">報廢</option>
                                <option value="其他修正">其他修正</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">備註說明</label>
                        <textarea 
                            value={formData.remarks}
                            onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                            className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm min-h-[80px]"
                            placeholder="請在此註明本次異動的細節..."
                        />
                    </div>

                    <div className="pt-4 flex gap-4">
                        <button 
                            type="button" onClick={onClose}
                            className="flex-1 px-6 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                        >
                            取消
                        </button>
                        <button 
                            type="submit" disabled={isSubmitting}
                            className={`flex-[2] px-6 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50 ${type === 'inbound' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/25'}`}
                        >
                            {isSubmitting ? "紀錄中..." : (type === 'inbound' ? "確認入庫" : "確認調整")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
