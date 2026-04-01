"use client";

import { useState } from "react";
import * as actions from "../actions";

interface GoogleSyncSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onManualSync: () => void;
}

export default function GoogleSyncSettingsModal({ isOpen, onClose, onManualSync }: GoogleSyncSettingsModalProps) {
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

    if (!isOpen) return null;

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const res = await actions.testGoogleSyncAction();
            setTestResult({
                success: res.success,
                message: res.message || (res.success ? "連線成功！" : "連線失敗！"),
                details: (res as any).details
            });
        } catch (error: any) {
            setTestResult({ success: false, message: `呼叫失敗: ${error.message}` });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-800 flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Google 日曆同步設定
                    </h2>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-6 bg-zinc-50 dark:bg-zinc-900/10">
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={handleTestConnection}
                            disabled={isTesting}
                            className="w-full py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 rounded-xl font-bold flex flex-col items-center justify-center transition-all disabled:opacity-50"
                        >
                            <span className="flex items-center gap-2">
                                <svg className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                測試連線狀態
                            </span>
                        </button>
                        {testResult && (
                            <div className={`p-3 rounded-lg text-xs font-bold space-y-1 ${testResult.success ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                                <div>{testResult.message}</div>
                                {testResult.details && <div className="opacity-70 font-mono font-normal">詳細: {testResult.details}</div>}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <p className="text-xs text-zinc-500 mb-3 text-center">
                            當前系統採用單向強制同步（內部 → Google），外部事件僅供唯讀參考，如需重新加載外部事件，請點擊下方按鈕。
                        </p>
                        <button
                            onClick={() => {
                                onClose();
                                onManualSync();
                            }}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            立即重新同步視圖
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
