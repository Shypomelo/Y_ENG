"use client";

import { useState, useEffect } from "react";
import { createSETrackingAction, updateSETrackingAction } from "../actions";

interface SETrackingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    initialData?: any;
}

export default function SETrackingModal({ isOpen, onClose, onSave, initialData }: SETrackingModalProps) {
    const [formData, setFormData] = useState<any>({
        case_name: "",
        old_model: "",
        old_sn: "",
        fault_reason: "",
        new_sn: "",
        receive_method: "",
        received_at: "",
        replacement_date: "",
        remarks: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                case_name: initialData.case_name || "",
                old_model: initialData.old_model || "",
                old_sn: initialData.old_sn || "",
                fault_reason: initialData.fault_reason || "",
                new_sn: initialData.new_sn || "",
                receive_method: initialData.receive_method || "",
                received_at: initialData.received_at ? initialData.received_at.split('T')[0] : "",
                replacement_date: initialData.replacement_date || "",
                remarks: initialData.remarks || ""
            });
        } else {
            setFormData({
                case_name: "",
                old_model: "",
                old_sn: "",
                fault_reason: "",
                new_sn: "",
                receive_method: "",
                received_at: "",
                replacement_date: "",
                remarks: ""
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const dataToSubmit = {
                ...formData,
                received_at: formData.received_at ? new Date(formData.received_at).toISOString() : null,
                replacement_date: formData.replacement_date || null,
            };

            if (initialData?.id) {
                await updateSETrackingAction(initialData.id, dataToSubmit);
            } else {
                await createSETrackingAction(dataToSubmit);
            }
            onSave();
            onClose();
        } catch (error) {
            console.error("Failed to save SE tracking:", error);
            alert("儲存失敗，請檢查主控台錯誤訊息");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-white/[0.02]">
                    <div>
                        <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                            {initialData ? "編輯 SE提供紀錄" : "新增 SE提供紀錄"}
                        </h2>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">SE Replacement Tracking</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Case Name */}
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">案名</label>
                            <input 
                                type="text" name="case_name" value={formData.case_name} onChange={handleChange}
                                className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm"
                                placeholder="例如：桃園觀音-王鶯勳-宋春女"
                                required
                            />
                        </div>

                        {/* Old Model & SN */}
                        <div>
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">原故障型號</label>
                            <input 
                                type="text" name="old_model" value={formData.old_model} onChange={handleChange}
                                className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm"
                                placeholder="例如：5K"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">故障序號</label>
                            <input 
                                type="text" name="old_sn" value={formData.old_sn} onChange={handleChange}
                                className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm"
                                placeholder="例如：074030C78-FB"
                            />
                        </div>

                        {/* New SN & Fault Reason */}
                        <div>
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">新物料序號</label>
                            <input 
                                type="text" name="new_sn" value={formData.new_sn} onChange={handleChange}
                                className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm"
                                placeholder="例如：07506094A-CE"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">故障原因</label>
                            <input 
                                type="text" name="fault_reason" value={formData.fault_reason} onChange={handleChange}
                                className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm"
                                placeholder="例如：18XBC"
                            />
                        </div>

                        {/* Receive Method & Received At */}
                        <div>
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">收貨方式</label>
                            <input 
                                type="text" name="receive_method" value={formData.receive_method} onChange={handleChange}
                                className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm"
                                placeholder="例如：SE寄件到北辦"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">收取物料時間</label>
                            <input 
                                type="date" name="received_at" value={formData.received_at} onChange={handleChange}
                                className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm"
                            />
                        </div>

                        {/* Replacement Date */}
                        <div>
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">更換日期</label>
                            <input 
                                type="date" name="replacement_date" value={formData.replacement_date} onChange={handleChange}
                                className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm"
                            />
                            <p className="mt-1 text-[9px] text-zinc-400 font-bold ml-1 italic">留空為「待更換」，填寫即為「已更換」</p>
                        </div>

                        {/* Remarks */}
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">備註事項</label>
                            <textarea 
                                name="remarks" value={formData.remarks} onChange={handleChange}
                                className="w-full px-5 py-3.5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm min-h-[80px]"
                                placeholder="其他需要註記的事項..."
                            />
                        </div>
                    </div>

                    <div className="mt-10 flex gap-4">
                        <button 
                            type="button" onClick={onClose}
                            className="flex-1 px-8 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                        >
                            取消
                        </button>
                        <button 
                            type="submit" disabled={isSubmitting}
                            className="flex-[2] px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSubmitting ? "儲存中..." : "確認儲存"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
