"use client";

import { useEffect, useMemo, useState } from "react";
import MaintenanceTabs from "./components/MaintenanceTabs";
import PendingMaintenanceCard from "./components/PendingMaintenanceCard";
import PendingMaintenanceList from "./components/PendingMaintenanceList";
import MaintenanceReportModal from "./components/MaintenanceReportModal";
import ReconciliationTab from "./components/ReconciliationTab";
import CompletedMaintenanceTab from "./components/CompletedMaintenanceTab";
import * as actions from "./actions";
import { MaintenanceReport } from "../../lib/types/database";

const EMPTY_SYNC_STATUS: actions.MaintenanceNorthSyncStatus = {
    status: "idle",
    last_sync_at: null,
    last_success_at: null,
    last_error: null,
    trigger: null,
    synced_count: 0,
    needs_refresh_count: 0,
    source_of_truth: "external",
    identity_mode: "fallback_key",
    sync_source: "browser",
    sync_mode: null,
};

export default function MaintenancePage() {
    const [activeTab, setActiveTab] = useState("pending");
    const [viewMode, setViewMode] = useState<"card" | "list">("card");
    const [tickets, setTickets] = useState<any[]>([]);
    const [reports, setReports] = useState<MaintenanceReport[]>([]);
    const [reconciliationItems, setReconciliationItems] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [syncStatus, setSyncStatus] = useState<actions.MaintenanceNorthSyncStatus>(EMPTY_SYNC_STATUS);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalInitialData, setModalInitialData] = useState<any>(undefined);

    const fetchData = async () => {
        setIsLoading(true);

        try {
            const [northReports, reportRows, reconciliationRows, projectRows, contactRows, statusRow] =
                await Promise.all([
                    actions.listMaintenanceNorthReportsAction(),
                    actions.listMaintenanceReportsAction(),
                    actions.listReconciliationPendingAction(),
                    actions.listProjectsMinimalAction(),
                    actions.listUnifiedContactsAction(),
                    actions.getMaintenanceNorthSyncStatusAction(),
                ]);

            setTickets(northReports);
            setReports(reportRows);
            setReconciliationItems(reconciliationRows);
            setProjects(projectRows);
            setContacts(contactRows);
            setSyncStatus(statusRow);
        } catch (error) {
            console.error("Failed to fetch maintenance data", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSync = async (trigger: "manual" | "auto", silent = false) => {
        if (!silent) {
            setIsSyncing(true);
        }

        setSyncStatus((prev) => ({
            ...(prev || EMPTY_SYNC_STATUS),
            status: "syncing",
            trigger,
            last_error: null,
        }));

        try {
            const result = await actions.syncMaintenanceNorthReportsAction(trigger);
            setSyncStatus(result.sync_status);
            await fetchData();
        } catch (error) {
            console.error("Failed to sync maintenance north reports", error);
            await fetchData();
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        void fetchData();
    }, []);

    useEffect(() => {
        void handleSync("auto", true);
    }, []);

    useEffect(() => {
        const timer = window.setInterval(() => {
            void handleSync("auto", true);
        }, 5 * 60 * 1000);

        return () => window.clearInterval(timer);
    }, []);

    const enrichedTickets = useMemo(() => {
        return tickets.map((ticket) => {
            const summary = ticket.issue_summary || "";
            const tagMatch = summary.match(/\[(.*?)\]/);
            const issueTag = tagMatch ? tagMatch[1] : "";

            let issueDescription = summary;
            if (tagMatch) {
                const tagIndex = summary.indexOf(tagMatch[0]);
                issueDescription = summary.substring(tagIndex + tagMatch[0].length).trim();
            }

            const ticketCaseNo = (ticket.case_no || "").trim();
            const ticketCaseName = (ticket.case_name || "").trim();

            let contact = contacts.find((item) => item["案場編號"] && item["案場編號"].trim() === ticketCaseNo);
            if (!contact && ticketCaseName) {
                contact = contacts.find((item) => item["案場名稱"] && item["案場名稱"].trim() === ticketCaseName);
            }

            let project = projects.find((item) => item.case_no && item.case_no.trim() === ticketCaseNo);
            if (!project && ticketCaseName) {
                project = projects.find((item) => item.name && item.name.trim() === ticketCaseName);
            }

            const address = contact?.["地址"] || project?.address || ticket.address || null;
            const mapUrl = address
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
                : null;
            const bizNote = contact?.["業務備註"] || "";
            const engNote = contact?.["工程備註"] || "";
            const note = bizNote && engNote
                ? `業務: ${bizNote}\n工程: ${engNote}`
                : (bizNote || engNote || "");

            return {
                ...ticket,
                issue_tag: issueTag,
                issue_description: issueDescription,
                address,
                map_url: mapUrl,
                site_contact_name: contact?.["聯絡人"] || project?.site_contact_name || null,
                site_contact_phone: contact?.["聯絡電話"] || project?.site_contact_phone || null,
                note: note || null,
            };
        });
    }, [contacts, projects, tickets]);

    const groupedTickets = useMemo(() => {
        const optimizers: any[] = [];
        const general: any[] = [];

        enrichedTickets.forEach((ticket) => {
            if (ticket.optimizer_count !== null && ticket.optimizer_count <= 3) {
                optimizers.push(ticket);
                return;
            }

            general.push(ticket);
        });

        return { optimizers, general };
    }, [enrichedTickets]);

    const syncStatusBadge = useMemo(() => {
        if (isSyncing || syncStatus.status === "syncing") {
            return { label: "同步中", className: "bg-blue-600 text-white" };
        }

        if (syncStatus.status === "failed") {
            return { label: "失敗", className: "bg-red-600 text-white" };
        }

        if (syncStatus.status === "success") {
            return { label: "成功", className: "bg-emerald-600 text-white" };
        }

        return { label: "待命", className: "bg-zinc-800 text-white" };
    }, [isSyncing, syncStatus.status]);

    const lastSyncLabel = useMemo(() => {
        if (!syncStatus.last_sync_at) {
            return "尚未同步";
        }

        return new Date(syncStatus.last_sync_at).toLocaleString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
    }, [syncStatus.last_sync_at]);

    const lastSuccessLabel = useMemo(() => {
        if (!syncStatus.last_success_at) {
            return "尚未成功同步";
        }

        return new Date(syncStatus.last_success_at).toLocaleString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
    }, [syncStatus.last_success_at]);

    const displayLastSyncLabel = useMemo(() => {
        if (!syncStatus.last_success_at) {
            return "尚未完整同步";
        }

        return new Date(syncStatus.last_success_at).toLocaleString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
    }, [syncStatus.last_success_at]);

    const lastAttemptLabel = useMemo(() => {
        if (!syncStatus.last_sync_at) {
            return "尚未嘗試同步";
        }

        return new Date(syncStatus.last_sync_at).toLocaleString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
    }, [syncStatus.last_sync_at]);

    const lastTriggerLabel = useMemo(() => {
        if (syncStatus.trigger === "manual") {
            return "手動同步";
        }

        if (syncStatus.trigger === "auto") {
            return "自動同步";
        }

        if (syncStatus.trigger === "read_fallback") {
            return "讀取備援";
        }

        return "尚未觸發";
    }, [syncStatus.trigger]);

    const handleCreateReport = (ticket: any) => {
        const ticketCaseNo = (ticket.case_no || "").trim();
        const ticketCaseName = (ticket.case_name || "").trim();
        const externalTicketId = ticket.external_ticket_id || ticket.id;
        const latestExternalDiff = {
            address: ticket.address || null,
            site_contact_name: ticket.site_contact_name || null,
            site_contact_phone: ticket.site_contact_phone || null,
            status: ticket.repair_status || null,
            monitor_staff: ticket.monitor_staff || null,
            monitor_judgement: ticket.monitor_judgement || null,
            repair_staff: ticket.repair_staff || null,
            work_date: ticket.work_date || null,
            complete_date: ticket.complete_date || null,
            external_note: ticket.external_note || null,
        };

        const existingReport = reports.find((report) =>
            ((report as any).external_ticket_id && (report as any).external_ticket_id === externalTicketId) ||
            (report.case_no && report.case_no.trim() === ticketCaseNo) ||
            (report.case_name && report.case_name.trim() === ticketCaseName),
        );

        if (existingReport) {
            setModalInitialData({
                ...existingReport,
                external_ticket_id: externalTicketId,
                conflict_status: ticket.conflict_status || null,
                latest_external_diff: latestExternalDiff,
            });
        } else {
            setModalInitialData({
                external_ticket_id: externalTicketId,
                case_name: ticket.case_name,
                case_no: ticket.case_no,
                address: ticket.address,
                site_contact_name: ticket.site_contact_name,
                site_contact_phone: ticket.site_contact_phone,
                latest_external_diff: latestExternalDiff,
                status: ticket.repair_status === "待處理" ? "待處理" : ticket.repair_status,
            });
        }

        setIsModalOpen(true);
    };

    const tabs = [
        { id: "pending", label: "待處理工單" },
        { id: "reconciliation", label: `待核料件 (${reconciliationItems.length})` },
        { id: "completed", label: "已完成回報" },
    ];

    return (
        <div className="container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
            <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div>
                    <h1 className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-4xl font-black tracking-tight text-transparent">
                        維運管理
                    </h1>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 opacity-80">
                        Maintenance Hub / North Region
                    </p>
                </div>

                <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
                    <button
                        onClick={() => void handleSync("manual")}
                        disabled={isSyncing}
                        data-testid="manual-sync-button"
                        className="flex items-center justify-center gap-3 rounded-[1.8rem] bg-blue-600 px-6 py-4 font-black text-white shadow-[0_20px_40px_-15px_rgba(37,99,235,0.35)] transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
                    >
                        <svg
                            className={`h-5 w-5 ${isSyncing ? "animate-spin" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                        立即同步
                    </button>

                    <button
                        onClick={() => {
                            setModalInitialData(undefined);
                            setIsModalOpen(true);
                        }}
                        className="group flex items-center justify-center gap-3 rounded-[1.8rem] bg-zinc-900 px-8 py-4 font-black text-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] transition-all hover:bg-zinc-800 active:scale-95 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                        <svg
                            className="h-5 w-5 transition-transform group-hover:rotate-90"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                        </svg>
                        新增維運回報
                    </button>
                </div>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-4">
                <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                北區同步狀態
                            </div>
                            <div className="mt-2 text-sm font-bold text-zinc-500">最後同步時間</div>
                            <div data-testid="sync-last-time" className="mt-1 text-lg font-black text-zinc-900 dark:text-zinc-100">
                                {displayLastSyncLabel}
                            </div>
                        </div>

                        <span data-testid="sync-status-badge" className={`rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-widest shadow-lg ${syncStatusBadge.className}`}>
                            {syncStatusBadge.label}
                        </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-zinc-500 sm:grid-cols-3">
                        <div data-testid="sync-source-label">本次來源: external</div>
                        <div data-testid="sync-identity-label">識別方式: fallback key</div>
                        <div data-testid="sync-count-label">本次同步筆數: {syncStatus.synced_count}</div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-zinc-500 sm:grid-cols-3">
                        <div data-testid="sync-trigger-label">最近觸發方式: {lastTriggerLabel}</div>
                        <div data-testid="sync-last-success-label">最近成功時間: {lastSuccessLabel}</div>
                    </div>

                    <div data-testid="sync-last-attempt-label" className="mt-2 text-sm text-zinc-500">
                        最近同步嘗試: {lastAttemptLabel}
                    </div>

                    {syncStatus.last_error && (
                        <div
                            data-testid="sync-error-message"
                            className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
                        >
                            {syncStatus.last_error}
                        </div>
                    )}
                </div>

                <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">同步模式</div>
                    <div className="mt-3 text-lg font-black text-zinc-900 dark:text-zinc-100">每 5 分鐘</div>
                    <div className="mt-2 text-sm font-bold text-zinc-500">北區 / 單向同步 / fallback key</div>
                </div>

                <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">needs_refresh</div>
                    <div
                        data-testid="needs-refresh-count"
                        className={`mt-3 text-3xl font-black ${
                            syncStatus.needs_refresh_count > 0 ? "text-amber-600" : "text-zinc-900 dark:text-zinc-100"
                        }`}
                    >
                        {syncStatus.needs_refresh_count}
                    </div>
                    <div data-testid="needs-refresh-hint" className="mt-2 text-sm font-bold text-zinc-500">
                        外部更新後待重新比對
                    </div>
                    {syncStatus.needs_refresh_count > 0 && (
                        <div
                            data-testid="needs-refresh-alert"
                            className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300"
                        >
                            目前有 {syncStatus.needs_refresh_count} 筆外部資料已更新，請留意是否需要重新比對。
                        </div>
                    )}
                </div>
            </div>

            <MaintenanceTabs activeTab={activeTab} onTabChange={setActiveTab} tabs={tabs} />

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {activeTab === "pending" && (
                        <>
                            <div className="mb-8 flex items-center justify-between">
                                <div className="pl-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                    {tickets.length} 筆待處理工單
                                </div>

                                <div className="rounded-2xl bg-zinc-100 p-1.5 shadow-inner dark:bg-zinc-800">
                                    <button
                                        onClick={() => setViewMode("card")}
                                        className={`rounded-xl px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                                            viewMode === "card"
                                                ? "bg-white text-blue-600 shadow-xl dark:bg-zinc-700"
                                                : "text-zinc-500"
                                        }`}
                                    >
                                        卡片
                                    </button>
                                    <button
                                        onClick={() => setViewMode("list")}
                                        className={`rounded-xl px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                                            viewMode === "list"
                                                ? "bg-white text-blue-600 shadow-xl dark:bg-zinc-700"
                                                : "text-zinc-500"
                                        }`}
                                    >
                                        列表
                                    </button>
                                </div>
                            </div>

                            {groupedTickets.optimizers.length > 0 && (
                                <div className="mb-12">
                                    <h2 className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:bg-amber-900/20">
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500"></span>
                                        Optimizer 工單: 3 顆以下優先處理
                                    </h2>

                                    {viewMode === "card" ? (
                                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                                            {groupedTickets.optimizers.map((ticket) => (
                                                <PendingMaintenanceCard
                                                    key={ticket.id}
                                                    ticket={ticket}
                                                    onCreateReport={handleCreateReport}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <PendingMaintenanceList
                                            tickets={groupedTickets.optimizers}
                                            onCreateReport={handleCreateReport}
                                        />
                                    )}
                                </div>
                            )}

                            <div>
                                {groupedTickets.optimizers.length > 0 && (
                                    <h2 className="mb-6 pl-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                        其他待處理工單
                                    </h2>
                                )}

                                {groupedTickets.general.length === 0 && groupedTickets.optimizers.length === 0 ? (
                                    <div className="rounded-[3rem] border-2 border-dashed border-zinc-200 py-24 text-center text-xs font-black uppercase tracking-[0.2em] text-zinc-400 dark:border-zinc-800">
                                        目前沒有待處理工單
                                    </div>
                                ) : viewMode === "card" ? (
                                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                                        {groupedTickets.general.map((ticket) => (
                                            <PendingMaintenanceCard
                                                key={ticket.id}
                                                ticket={ticket}
                                                onCreateReport={handleCreateReport}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <PendingMaintenanceList
                                        tickets={groupedTickets.general}
                                        onCreateReport={handleCreateReport}
                                    />
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === "reconciliation" && (
                        <ReconciliationTab items={reconciliationItems} onRefresh={fetchData} />
                    )}

                    {activeTab === "completed" && (
                        <CompletedMaintenanceTab
                            reports={reports}
                            onEdit={(report) => {
                                setModalInitialData(report);
                                setIsModalOpen(true);
                            }}
                        />
                    )}
                </div>
            )}

            <MaintenanceReportModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={fetchData}
                initialData={modalInitialData}
            />
        </div>
    );
}
