"use client";

import { useState } from "react";
import SETrackingModal from "./SETrackingModal";

interface SETrackingTableProps {
    data: any[];
    onRefresh?: () => void;
}

export default function SETrackingTable({ data, onRefresh }: SETrackingTableProps) {
    const [view, setView] = useState<'pending' | 'replaced'>('pending');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    const filtered = data.filter(item => 
        view === 'pending' ? !item.replacement_date : !!item.replacement_date
    );

    const handleNewRecord = () => {
        setEditingItem(null);
        setIsModalOpen(true);
    };

    const handleSave = () => {
        setIsModalOpen(false);
        if (onRefresh) {
            onRefresh();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl w-fit">
                    <button 
                        onClick={() => setView('pending')}
                        className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'pending' ? 'bg-white dark:bg-zinc-900 shadow-sm text-blue-600' : 'text-zinc-400 hover:text-zinc-600'}`}
                    >
                        待更換 / 未使用 ({data.filter(i => !i.replacement_date).length})
                    </button>
                    <button 
                        onClick={() => setView('replaced')}
                        className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'replaced' ? 'bg-white dark:bg-zinc-900 shadow-sm text-emerald-600' : 'text-zinc-400 hover:text-zinc-600'}`}
                    >
                        已更換 ({data.filter(i => !!i.replacement_date).length})
                    </button>
                </div>
                <button 
                    onClick={handleNewRecord}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all uppercase tracking-widest active:scale-95"
                >
                    新增 SE提供紀錄
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-50/50 dark:bg-white/[0.02] border-b border-zinc-100 dark:border-zinc-800">
                            <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">案名 / 型號</th>
                            <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">序號 / 狀態</th>
                            <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">故障 / 收貨</th>
                            <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">備註</th>
                            <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-8 py-20 text-center text-zinc-400 font-bold uppercase tracking-widest text-xs">
                                    尚無維修追蹤紀錄
                                </td>
                            </tr>
                        ) : filtered.map(item => (
                            <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.01] transition-colors group">
                                <td className="px-8 py-6">
                                    <div className="font-black text-zinc-900 dark:text-zinc-100">{item.case_name}</div>
                                    <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{item.old_model || "-"} {item.old_sn ? `(${item.old_sn})` : ""}</div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="text-sm font-black text-zinc-700 dark:text-zinc-300 font-mono">{item.new_sn}</div>
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600">
                                            <span className={`w-1.5 h-1.5 rounded-full ${item.replacement_date ? 'bg-emerald-500' : 'bg-red-400 animate-pulse'}`}></span>
                                            更換：{item.replacement_date ? item.replacement_date : '待更換 / 未使用'}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="text-[10px] font-black text-zinc-500 dark:text-zinc-400">原因: {item.fault_reason || "未註記"}</div>
                                    <div className="text-[10px] font-black text-blue-600 mt-1 uppercase tracking-tighter">
                                        {item.receive_method || "未知方式"} 
                                        {item.received_at && <span className="ml-1 opacity-60">({item.received_at.split('T')[0]})</span>}
                                    </div>
                                </td>
                                <td className="px-8 py-6 max-w-[200px]">
                                    <div className="text-xs text-zinc-500 line-clamp-2 italic font-medium">{item.remarks || "-"}</div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <button 
                                        onClick={() => {
                                            setEditingItem(item);
                                            setIsModalOpen(true);
                                        }}
                                        className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-xl text-[10px] font-black hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 transition-all uppercase tracking-widest active:scale-95"
                                    >
                                        編輯
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <SETrackingModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSave={handleSave} 
                initialData={editingItem}
            />
        </div>
    );
}
