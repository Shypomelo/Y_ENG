"use client";

import { useState, useEffect } from "react";
import * as actions from "../actions";

interface InventoryMasterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    initialData?: any;
}

export default function InventoryMasterModal({ isOpen, onClose, onSave, initialData }: InventoryMasterModalProps) {
    const [formData, setFormData] = useState({
        name: "",
        category: "一般用料",
        bucket: "陽光庫存",
        remarks: "",
        sort_order: 0,
        is_active: true
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || "",
                category: initialData.category || "一般用料",
                bucket: initialData.bucket || "陽光庫存",
                remarks: initialData.remarks || "",
                sort_order: initialData.sort_order || 0,
                is_active: initialData.is_active !== false
            });
        } else {
            setFormData({
                name: "",
                category: "一般用料",
                bucket: "陽光庫存",
                remarks: "",
                sort_order: 0,
                is_active: true
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (initialData?.id) {
                await actions.updateInventoryItemAction(initialData.id, formData);
            } else {
                await actions.createInventoryItemAction(formData);
            }
            onSave();
            onClose();
        } catch (error) {
            console.error("Failed to save inventory item:", error);
            alert("儲存失敗，可能名稱重複或網路問題");
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
                            {initialData ? "編輯品項主檔" : "新增陽光庫存品項"}
                        </h2>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">Master Data Management</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">品項 / 型號名稱</label>
                        <input 
                            type="text" required
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm"
                            placeholder="例如：PV Cable 4mm2"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">分類</label>
                            <select 
                                value={formData.category}
                                onChange={(e) => setFormData({...formData, category: e.target.value})}
                                className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm appearance-none"
                            >
                                <option value="一般用料">一般用料</option>
                                <option value="SE物料">SE物料</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">顯示排序</label>
                            <input 
                                type="number"
                                value={formData.sort_order}
                                onChange={(e) => setFormData({...formData, sort_order: parseInt(e.target.value)})}
                                className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">備註說明</label>
                        <textarea 
                            value={formData.remarks}
                            onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                            className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm min-h-[80px]"
                            placeholder="品項的額外說明..."
                        />
                    </div>

                    <div className="flex items-center gap-3 px-1">
                        <input 
                            type="checkbox" id="is_active"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                            className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="is_active" className="text-xs font-bold text-zinc-600 dark:text-zinc-400">啟用此品項 (若不啟用，彙總表中將隱藏此列)</label>
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
                            className="flex-[2] px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSubmitting ? "儲存中..." : "確認儲存"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
