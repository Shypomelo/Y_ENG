"use client";

/**
 * Admin Console Tabs Component (Client Side)
 * Handles the nested tab navigation for the Admin Console.
 */

import { useState, useMemo } from "react";
import RawDataViewer from "./raw-data-viewer";

interface AdminTabsProps {
  sitesData: any;
  reportsData: any;
  contactsData?: any;
}

export default function AdminTabs({ sitesData, reportsData, contactsData }: AdminTabsProps) {
  const [activeTab, setActiveTab] = useState<"raw" | "auth">("raw");
  const [activeRawSubTab, setActiveRawSubTab] = useState<"sites" | "reports" | "contacts" | "projects">("sites");

  const GOOGLE_SHEETS_URL = "https://docs.google.com/spreadsheets/d/1tUqOOZ4WiJ_kNTmySuCbKuhHKhBFQvbP/edit?gid=1543676540#gid=1543676540";

  // 1. Regional Sorting for Sites (北區 -> 中區 -> 南區)
  const sortedSites = useMemo(() => {
    if (!sitesData?.data) return [];
    
    const data = [...sitesData.data];
    const regionOrder = ["北區", "中區", "南區"];
    
    return data.sort((a, b) => {
      // Primary Sort: Region
      const orderA = regionOrder.indexOf(a.region) === -1 ? 99 : regionOrder.indexOf(a.region);
      const orderB = regionOrder.indexOf(b.region) === -1 ? 99 : regionOrder.indexOf(b.region);
      
      if (orderA !== orderB) return orderA - orderB;
      
      // Secondary Sort: Case No
      const noA = (a.case_no || "").toString();
      const noB = (b.case_no || "").toString();
      return noA.localeCompare(noB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [sitesData]);

  // 2. Processing & Sorting for Contacts (Merging Notes + sorting by Case No)
  const processedContacts = useMemo(() => {
    if (!contactsData?.data) return [];
    
    // Create new objects to avoid mutating original data
    const data = contactsData.data.map((contact: any) => {
      const bizNote = contact["業務備註"] || "";
      const engNote = contact["工程備註"] || "";
      
      let mergedNote = "";
      if (bizNote && engNote) {
        mergedNote = `業務：${bizNote}\n工程：${engNote}`;
      } else {
        mergedNote = bizNote || engNote || "";
      }
      
      return {
        ...contact,
        "備註": mergedNote
      };
    });

    // Sort by Case No (案號)
    return data.sort((a: any, b: any) => {
      const noA = (a["案號"] || "").toString();
      const noB = (b["案號"] || "").toString();
      return noA.localeCompare(noB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [contactsData]);

  return (
    <div className="flex flex-col gap-6">
      {/* Level 1 Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="flex gap-8">
          <button 
            onClick={() => setActiveTab("raw")}
            className={`border-b-2 py-2 text-sm font-semibold transition-colors ${
              activeTab === "raw" 
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50" 
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            原始資料
          </button>
          <button 
            onClick={() => setActiveTab("auth")}
            className={`border-b-2 py-2 text-sm font-semibold transition-colors ${
              activeTab === "auth" 
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50" 
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            帳號與權限
          </button>
        </nav>
      </div>

      {/* Level 1 Content */}
      {activeTab === "raw" ? (
        <div className="flex flex-col gap-6">
          {/* Level 2 Tabs (Sub-tabs for Raw Data) */}
          <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg w-fit">
            {[
              { id: "sites", label: "案場原始資料" },
              { id: "reports", label: "待修原始資料" },
              { id: "contacts", label: "通訊錄原始資料" },
              { id: "projects", label: "專案原始資料" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveRawSubTab(tab.id as any)}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeRawSubTab === tab.id
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Level 2 Content */}
          <div className="mt-2 h-full min-h-[500px]">
            {activeRawSubTab === "sites" && (
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-between items-center">
                  <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">案場全量原始資料 (依區域排序: 北/中/南)</h2>
                  <span className="text-[10px] text-zinc-500 font-mono">來源: north-sites-master.json</span>
                </div>
                <RawDataViewer 
                  data={sortedSites} 
                  meta={sitesData}
                  emptyMessage="尚無案場原始資料"
                  filterRegion="" 
                />
              </div>
            )}

            {activeRawSubTab === "reports" && (
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-between items-center">
                  <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">待修原始資料 (Raw Reports)</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 font-mono">來源: north-reports.normalized.json</span>
                  </div>
                </div>
                {reportsData ? (
                   <RawDataViewer 
                    data={reportsData?.data || []} 
                    meta={reportsData?.meta || {}}
                    emptyMessage="尚無待維修原始資料"
                    filterRegion="" 
                  />
                ) : (
                  <div className="p-12 text-center text-red-500 bg-red-50 dark:bg-red-950/20 text-sm">
                     ⚠️ 無法讀取待維修原始資料檔案
                  </div>
                )}
              </div>
            )}

            {activeRawSubTab === "contacts" && (
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm flex flex-col min-h-[400px]">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-between items-center">
                  <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">維運通訊錄 (整合清單 - 備註已合併)</h2>
                  <div className="flex items-center gap-4">
                    <a href={GOOGLE_SHEETS_URL} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline font-mono">來源 Google Sheets ↗</a>
                    <span className="text-[10px] text-zinc-500 font-mono">north-contacts.normalized.json</span>
                  </div>
                </div>
                
                {contactsData && contactsData.data && contactsData.data.length > 0 ? (
                   <div className="flex flex-col">
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                        <p className="text-[10px] text-zinc-400 italic">已橫跨整份 Google Sheets 整合共 {contactsData.meta?.mergedSheets?.length || 0} 個工作表資料。</p>
                        <p className="text-[10px] text-zinc-400">總計 {contactsData.data.length} 筆聯絡資訊</p>
                      </div>

                      <RawDataViewer 
                        data={processedContacts} 
                        meta={contactsData.meta}
                        emptyMessage="尚未匯入通訊錄資料"
                        showSearch={true}
                        filterRegion=""
                      />
                   </div>
                ) : (
                   <div className="p-12 flex flex-col gap-8">
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-red-500 mb-2">⚠️ 尚未匯入整合資料</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed mb-4">
                        請確認 `maintenance-probe/ingest-contacts.js` 已成功執行匯入腳本。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeRawSubTab === "projects" && (
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 overflow-hidden min-h-[400px] flex flex-col items-center justify-center p-12 text-center shadow-inner">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                  <span className="text-zinc-400 text-xl grayscale opacity-50">🏗️</span>
                </div>
                <h3 className="text-zinc-900 dark:text-zinc-50 font-semibold mb-1">專案原始資料 (規劃中)</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">
                  此區塊預留給後續接入的「工程專案進度」原始資料。
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Section: Account & Permissions Placeholder */
        <div className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-10 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">帳號與權限 (Account & Permissions)</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-lg leading-relaxed">
              此分頁為未來系統的安全核心。後續將在此整合登入系統、多因子驗證 (MFA) 以及針對不同維運部隊的「人員權限控管」。
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {[
              { title: "帳號管理", desc: "主官/行政人員帳號建立、密碼重設與停用機制。" },
              { title: "人員角色 (Roles)", desc: "定義北區、中區、南區等不同部隊與職缺的角色權限集。" },
              { title: "權限控管 (ACL)", desc: "控制特定分頁或功能（如：維修回報、庫存調整）的可見度。" },
              { title: "管理者全域設定", desc: "調整系統核心參數、API 配置與全域變數。" },
            ].map((item, idx) => (
              <div key={idx} className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm opacity-80 group hover:opacity-100 transition-opacity">
                <div className="flex flex-col gap-2">
                  <p className="font-bold text-sm text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                    <span className="w-1 h-4 bg-zinc-300 dark:bg-zinc-700 rounded-full group-hover:bg-blue-500 transition-colors" />
                    {item.title}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed pl-3">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
