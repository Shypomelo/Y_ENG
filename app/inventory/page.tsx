"use client";

import React, { useEffect, useState } from "react";
import InventorySummaryTable from "./components/InventorySummaryTable";
import UsageDetailsTable from "./components/UsageDetailsTable";
import SimpleReconciliation from "./components/SimpleReconciliation";
import SETrackingTable from "./components/SETrackingTable";
import * as actions from "./actions";
import {
    getInventorySummaryAction,
    getMonthlyUsageLogsAction,
    getPendingReconciliationAction,
    isMonthArchivedAction,
    getDeletedInventoryItemsAction,
    addInboundLogAction,
    createItemAndInboundAction,
    upsertUsageLogAction,
    confirmReconciliationItemAction,
    confirmUsageAction,
    deleteUsageLogAction,
    archiveMonthAction,
    exportUsageCSVAction,
    exportInventoryCSVAction,
    restoreItemAction,
    updateItemRemarksAction,
    getSETrackingAction
} from "./actions";
import { InventoryItem } from "../../lib/repositories/inventory";

export default function InventoryDashboard() {
    const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().substring(0, 7));
    const [summary, setSummary] = useState<any[]>([]);
    const [usageLogs, setUsageLogs] = useState<any[]>([]);
    const [pendingReports, setPendingReports] = useState<any[]>([]);
    const [deletedItems, setDeletedItems] = useState<InventoryItem[]>([]);
    const [seTracking, setSeTracking] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isArchive, setIsArchive] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);
    const [activeTab, setActiveTab] = useState<'sunshine' | 'se' | 'recon'>('sunshine');


    useEffect(() => {
        fetchData();
    }, [currentMonth, activeTab]);

    async function fetchData() {
        setIsLoading(true);
        try {
            const bucket = activeTab === 'se' ? 'SE提供' : (activeTab === 'sunshine' ? '陽光庫存' : undefined);

            // Execute all as settled promises or handle individually to prevent partial schema failures
            const results = await Promise.allSettled([
                getInventorySummaryAction(currentMonth, bucket),
                getMonthlyUsageLogsAction(currentMonth, bucket),
                getPendingReconciliationAction(),
                isMonthArchivedAction(currentMonth),
                getDeletedInventoryItemsAction(),
                getSETrackingAction()
            ]);

            // Unpack results safely
            if (results[0].status === 'fulfilled') setSummary(results[0].value);
            if (results[1].status === 'fulfilled') setUsageLogs(results[1].value);
            if (results[2].status === 'fulfilled') setPendingReports(results[2].value);
            if (results[3].status === 'fulfilled') setIsArchive(results[3].value);
            if (results[4].status === 'fulfilled') setDeletedItems(results[4].value);
            if (results[5].status === 'fulfilled') setSeTracking(results[5].value);

            // Log rejected promises
            results.forEach((res, idx) => {
                if (res.status === 'rejected') {
                    console.error(`Fetch task ${idx} failed:`, res.reason);
                }
            });

        } catch (error) {
            console.error("Critical error in fetchData:", error);
        } finally {
            setIsLoading(false);
        }
    }


    const handleConfirmRecon = async (reconciliationId: string) => {
        try {
            await actions.confirmReconciliationItemAction(reconciliationId);
            fetchData();
        } catch (error: any) {
            alert(error.message || "核對失敗");
        }
    };

    const handleFinalizeUsage = async (id: string) => {
        try {
            await actions.confirmUsageAction(id);
            fetchData();
        } catch (error: any) {
            alert(error.message || "確認出庫失敗");
        }
    };

    const handleDeleteUsage = async (id: string) => {
        if (!confirm("確定要刪除這筆使用紀錄嗎？這會影響庫存結餘。")) return;
        try {
            await actions.deleteUsageLogAction(id);
            fetchData();
        } catch (error: any) {
            alert(error.message || "刪除失敗");
        }
    };

    const handleRestoreItem = async (id: string) => {
        try {
            await actions.restoreItemAction(id);
            fetchData();
        } catch (error) {
            alert("恢復失敗");
        }
    };

    const handleArchive = async () => {
        if (!confirm(`確定要封存 ${currentMonth} 的庫存嗎？封存後資料將變更為唯讀。`)) return;
        try {
            await actions.archiveMonthAction(currentMonth);
            alert("封存成功");
            fetchData();
        } catch (error) {
            alert("封存失敗");
        }
    };

    const handleDownloadCSV = async (type: 'usage' | 'summary') => {
        try {
            const bucket = activeTab === 'se' ? 'SE提供' : (activeTab === 'sunshine' ? '陽光庫存' : undefined);
            const csv = type === 'usage'
                ? await actions.exportUsageCSVAction(currentMonth)
                : await actions.exportInventoryCSVAction(currentMonth);

            const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `inventory_${type}_${currentMonth}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            alert("下載失敗");
        }
    };

    return (
        <div className="container mx-auto max-w-7xl p-4 sm:p-6 lg:p-10 min-h-screen bg-zinc-50/20 dark:bg-zinc-950/20 space-y-12 font-sans animate-in fade-in duration-500">
            {/* Header Area */}
            <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-4">
                <div className="space-y-4">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/40">
                            <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter uppercase">庫存管理</h1>
                            <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[11px] font-black text-blue-500/70 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-lg tracking-widest border border-blue-100/50">庫存主控模組</span>
                                {isArchive && <span className="bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-[10px] px-3 py-1 rounded-full font-black shadow-lg">已封存 / 唯讀</span>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center bg-white dark:bg-zinc-900 rounded-[1.25rem] border border-zinc-200 dark:border-zinc-800 p-2 shadow-sm">
                        <span className="text-[10px] font-black text-zinc-400 ml-3 mr-1 uppercase tracking-widest">選擇月份</span>
                        <input
                            type="month"
                            disabled={isLoading}
                            value={currentMonth}
                            onChange={(e) => setCurrentMonth(e.target.value)}
                            className="bg-transparent px-4 py-2 text-sm font-black text-zinc-900 dark:text-zinc-50 outline-none cursor-pointer"
                        />
                    </div>


                    <div className="h-10 w-[2px] bg-zinc-200 dark:bg-zinc-800 mx-2 hidden lg:block"></div>

                    {!isArchive && (
                        <button
                            onClick={handleArchive}
                            className="px-8 py-4 rounded-[1.25rem] border border-zinc-200 dark:border-zinc-800 text-sm font-black hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95"
                        >
                            封存本月
                        </button>
                    )}

                    <div className="relative group">
                        <button className="px-6 py-4 rounded-[1.25rem] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 text-sm font-black flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                        <div className="absolute right-0 top-full mt-3 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-3xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-3 transform origin-top-right scale-95 group-hover:scale-100 duration-300">
                            <button onClick={() => handleDownloadCSV('usage')} className="w-full text-left px-5 py-3 text-xs font-black hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-all mb-1 uppercase tracking-tighter">Export Usage Log (.csv)</button>
                            <button onClick={() => handleDownloadCSV('summary')} className="w-full text-left px-5 py-3 text-xs font-black hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-all uppercase tracking-tighter">Export Monthly Summary (.csv)</button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1.5 rounded-[1.8rem] border border-zinc-200 dark:border-zinc-800 shadow-sm w-fit">
                {[
                    { id: 'recon', name: '維修核對', count: pendingReports.length, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                    { id: 'sunshine', name: '陽光庫存', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' },
                    { id: 'se', name: 'SE提供', icon: 'M13 10V3L4 14h7v7l9-11h-7z' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-3 px-8 py-3.5 rounded-[1.5rem] text-xs font-black transition-all uppercase tracking-widest ${activeTab === tab.id
                                ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20'
                                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={tab.icon} /></svg>
                        {tab.name}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white animate-pulse shadow-lg shadow-red-500/40">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Contents */}
            {activeTab === 'recon' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <SimpleReconciliation
                        reports={pendingReports}
                        onConfirm={handleConfirmRecon}
                    />
                    {pendingReports.length === 0 && (
                        <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-dashed border-zinc-200 dark:border-zinc-800 p-24 text-center space-y-4">
                            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center text-emerald-500 mx-auto shadow-inner">
                                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tight">查無待核對項目</h3>
                            <p className="text-zinc-400 text-xs font-bold max-w-xs mx-auto text-balance uppercase tracking-widest leading-relaxed">目前沒有需要核對的維修紀錄，庫存資料已更新至最新狀態。</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'se' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <SETrackingTable data={seTracking} onRefresh={fetchData} />
                </div>
            )}

            {(activeTab === 'sunshine') && (
                <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <InventorySummaryTable
                        data={summary}
                        isReadOnly={isArchive}
                        onRefresh={fetchData}
                        title={activeTab === 'sunshine' ? "陽光庫存 - 本月結餘總表" : "SE提供 - 料件紀錄"}
                    />
                    <UsageDetailsTable
                        logs={usageLogs}
                        isReadOnly={isArchive}
                        onDelete={handleDeleteUsage}
                        onFinalize={handleFinalizeUsage}
                    />
                </div>
            )}

            {/* Deleted Items Section */}
            {deletedItems.length > 0 && activeTab !== 'recon' && (
                <section className="mt-16 border-t border-zinc-100 dark:border-zinc-800 pt-10">
                    <button
                        onClick={() => setShowDeleted(!showDeleted)}
                        className="flex items-center gap-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors mx-auto group"
                    >
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">{showDeleted ? "Hide" : "Show"} Deleted Items ({deletedItems.length})</span>
                    </button>
                    {showDeleted && (
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                            {deletedItems.map(item => (
                                <div key={item.id} className="p-6 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="text-sm font-black text-zinc-400 line-through">{item.name}</div>
                                        <div className="text-[9px] font-black text-zinc-300 uppercase tracking-widest">{item.category} | {item.bucket}</div>
                                    </div>
                                    <button
                                        onClick={() => handleRestoreItem(item.id)}
                                        className="px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-blue-600 text-[10px] font-black shadow-inner hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                                    >
                                        Restore
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}


            {isLoading && (
                <div className="fixed top-6 right-6 z-[200] animate-in fade-in zoom-in duration-300">
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 px-6 py-3 rounded-full shadow-2xl flex items-center gap-4">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <div className="text-[9px] font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-[0.2em]">資料同步中</div>
                    </div>
                </div>
            )}
        </div>
    );
}
