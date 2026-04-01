"use client";

import { useState, useEffect, useMemo } from "react";
import MaintenanceTabs from "./components/MaintenanceTabs";
import PendingMaintenanceCard from "./components/PendingMaintenanceCard";
import PendingMaintenanceList from "./components/PendingMaintenanceList";
import MaintenanceReportModal from "./components/MaintenanceReportModal";
import ReconciliationTab from "./components/ReconciliationTab";
import CompletedMaintenanceTab from "./components/CompletedMaintenanceTab";
import * as actions from "./actions";
import { MaintenanceReport } from "../../lib/types/database";

export default function MaintenancePage() {
    const [activeTab, setActiveTab] = useState("pending");
    const [viewMode, setViewMode] = useState<"card" | "list">("card");
    const [tickets, setTickets] = useState<any[]>([]);
    const [reports, setReports] = useState<MaintenanceReport[]>([]);
    const [reconciliationItems, setReconciliationItems] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalInitialData, setModalInitialData] = useState<any>(undefined);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [nReports, rData, recData, pData, cData] = await Promise.all([
                actions.listMaintenanceNorthReportsAction(),
                actions.listMaintenanceReportsAction(),
                actions.listReconciliationPendingAction(),
                actions.listProjectsMinimalAction(),
                actions.listUnifiedContactsAction()
            ]);
            
            setTickets(nReports);
            setReports(rData);
            setReconciliationItems(recData);
            setProjects(pData);
            setContacts(cData);
        } catch (error) {
            console.error("Failed to fetch maintenance data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Enrich tickets with contact and project data
    const enrichedTickets = useMemo(() => {
        return tickets.map(ticket => {
            const summary = ticket.issue_summary || "";
            const tagMatch = summary.match(/\[(.*?)\]/);
            const issue_tag = tagMatch ? tagMatch[1] : "";
            
            let issue_description = summary;
            if (tagMatch) {
                const tagIndex = summary.indexOf(tagMatch[0]);
                issue_description = summary.substring(tagIndex + tagMatch[0].length).trim();
            }

            const tNo = (ticket.case_no || "").trim();
            const tName = (ticket.case_name || "").trim();

            let contact = contacts.find(c => c["案號"] && c["案號"].trim() === tNo);
            if (!contact && tName) {
                contact = contacts.find(c => c["案名"] && c["案名"].trim() === tName);
            }

            let project = projects.find(p => p.case_no && p.case_no.trim() === tNo);
            if (!project && tName) {
                project = projects.find(p => p.name && p.name.trim() === tName);
            }
            
            const address = contact?.["地址"] || project?.address || ticket.address || null;
            const map_url = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;

            const bizNote = contact?.["業務備註"] || "";
            const engNote = contact?.["工程備註"] || "";
            let mergedNote = "";
            if (bizNote && engNote) {
                mergedNote = `業務：${bizNote}\n工程：${engNote}`;
            } else {
                mergedNote = bizNote || engNote || "";
            }

            return {
                ...ticket,
                issue_tag,
                issue_description,
                address,
                map_url,
                site_contact_name: contact?.["聯絡人"] || project?.site_contact_name || null,
                site_contact_phone: contact?.["電話"] || project?.site_contact_phone || null,
                note: mergedNote || null 
            };
        });
    }, [tickets, projects, contacts]);

    // Grouping for Pending tab
    const groupedTickets = useMemo(() => {
        const general: any[] = [];
        const optimizers: any[] = [];

        enrichedTickets.forEach(t => {
            if (t.optimizer_count !== null && t.optimizer_count <= 3) {
                optimizers.push(t);
            } else {
                general.push(t);
            }
        });

        return { general, optimizers };
    }, [enrichedTickets]);

    const handleCreateReport = (ticket: any) => {
        const tNo = (ticket.case_no || "").trim();
        const tName = (ticket.case_name || "").trim();
        
        const existingReport = reports.find(r => 
            (r.case_no && r.case_no.trim() === tNo) || 
            (r.case_name && r.case_name.trim() === tName)
        );

        if (existingReport) {
            setModalInitialData({
                ...existingReport,
                ticket_id: ticket.id 
            });
        } else {
            setModalInitialData({
                ticket_id: ticket.id,
                case_name: ticket.case_name,
                case_no: ticket.case_no,
                address: ticket.address,
                site_contact_name: ticket.site_contact_name,
                site_contact_phone: ticket.site_contact_phone,
                status: ticket.repair_status === "待處理" ? "待安排" : ticket.repair_status,
            });
        }
        setIsModalOpen(true);
    };

    const tabs = [
        { id: "pending", label: "北區待維修" },
        { id: "reconciliation", label: `維修核對 (${reconciliationItems.length})` },
        { id: "completed", label: "已完成維修明細" },
    ];

    return (
        <div className="container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">維運總覽</h1>
                    <p className="text-zinc-500 mt-2 font-bold uppercase text-[10px] tracking-[0.2em] opacity-80">Maintenance Hub / North Region</p>
                </div>
                <button 
                    onClick={() => {
                        setModalInitialData(undefined);
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-3 px-8 py-4 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-[1.8rem] font-black shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_40px_-15px_rgba(255,255,255,0.1)] transition-all active:scale-95 group"
                >
                    <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                    新增維修回報
                </button>
            </div>

            <MaintenanceTabs 
                activeTab={activeTab} 
                onTabChange={setActiveTab} 
                tabs={tabs} 
            />

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {activeTab === "pending" && (
                        <>
                            <div className="flex justify-between items-center mb-8">
                                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-2">
                                    {tickets.length} 個待處理項目 (北區)
                                </div>
                                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl shadow-inner">
                                    <button 
                                        onClick={() => setViewMode("card")}
                                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "card" ? "bg-white dark:bg-zinc-700 shadow-xl text-blue-600" : "text-zinc-500"}`}
                                    >
                                        卡片
                                    </button>
                                    <button 
                                        onClick={() => setViewMode("list")}
                                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === "list" ? "bg-white dark:bg-zinc-700 shadow-xl text-blue-600" : "text-zinc-500"}`}
                                    >
                                        條列
                                    </button>
                                </div>
                            </div>

                            {groupedTickets.optimizers.length > 0 && (
                                <div className="mb-12">
                                    <h2 className="text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-4 py-1.5 rounded-full inline-flex items-center gap-2 tracking-widest uppercase mb-6">
                                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                                        優先處理: 優化器少量報修
                                    </h2>
                                    {viewMode === "card" ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                            {groupedTickets.optimizers.map(ticket => (
                                                <PendingMaintenanceCard key={ticket.id} ticket={ticket} onCreateReport={handleCreateReport} />
                                            ))}
                                        </div>
                                    ) : (
                                        <PendingMaintenanceList tickets={groupedTickets.optimizers} onCreateReport={handleCreateReport} />
                                    )}
                                </div>
                            )}

                            <div>
                                {groupedTickets.optimizers.length > 0 && (
                                    <h2 className="text-[10px] font-black text-zinc-400 uppercase mb-6 tracking-widest pl-2">
                                        一般待維修項目
                                    </h2>
                                )}
                                
                                {groupedTickets.general.length === 0 && groupedTickets.optimizers.length === 0 ? (
                                    <div className="py-24 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[3rem] text-zinc-400 font-black uppercase tracking-[0.2em] text-xs">
                                        目前北區尚無待維修項目
                                    </div>
                                ) : (
                                    viewMode === "card" ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                            {groupedTickets.general.map(ticket => (
                                                <PendingMaintenanceCard key={ticket.id} ticket={ticket} onCreateReport={handleCreateReport} />
                                            ))}
                                        </div>
                                    ) : (
                                        <PendingMaintenanceList tickets={groupedTickets.general} onCreateReport={handleCreateReport} />
                                    )
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === "reconciliation" && (
                        <ReconciliationTab items={reconciliationItems} onRefresh={fetchData} />
                    )}

                    {activeTab === "completed" && (
                        <CompletedMaintenanceTab reports={reports} onEdit={(r) => {
                            setModalInitialData(r);
                            setIsModalOpen(true);
                        }} />
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
