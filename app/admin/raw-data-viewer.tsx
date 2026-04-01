"use client";

import { useState, useMemo } from "react";

interface RawDataViewerProps {
  data: any[];
  meta?: any;
  emptyMessage?: string;
  showSearch?: boolean;
  filterRegion?: string;
}

export default function RawDataViewer({ 
  data, 
  meta, 
  emptyMessage = "尚無資料",
  showSearch = true,
  filterRegion = "" 
}: RawDataViewerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter logic
  const filteredData = useMemo(() => {
    if (!data) return [];
    
    return data.filter(item => {
      // 1. Region filter
      if (filterRegion && item.region && !item.region.includes(filterRegion)) {
        return false;
      }

      // 2. Search term filter
      if (!searchTerm) return true;
      
      const term = searchTerm.toLowerCase();
      // Search across ALL values in the object, including merged fields
      return Object.values(item).some(val => 
        String(val).toLowerCase().includes(term)
      );
    });
  }, [data, searchTerm, filterRegion]);

  // Robustly detect all columns from the dataset (check first 100 items)
  const allColumns = useMemo(() => {
    if (!data || data.length === 0) return [];
    const keys = new Set<string>();
    data.slice(0, 100).forEach(item => {
      Object.keys(item).forEach(k => keys.add(k));
    });
    return Array.from(keys);
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-500 text-sm italic">
        {emptyMessage}
      </div>
    );
  }

  // Requested columns priority
  const priorityColumns = [
    // Site keys
    "case_no", "case_name", "region", "address", "site_type", 
    "capacity", "warranty_status", "sales_owner", "maintenance_owner", 
    "site_status", "source_page", "extracted_at",
    // Contact keys
    "案號", "案名", "容量", "地址", "聯絡人", "電話", "負責業務", "備註", "來源工作表"
  ];

  // Columns to EXPLICITLY hide from priority
  const hideFromPriority = ["業務備註", "工程備註"];

  // Filter to columns that actually exist and are NOT in the hide list
  const columns = priorityColumns.filter(c => allColumns.includes(c) && !hideFromPriority.includes(c));
  
  // Any columns NOT in priority list go to "Extra"
  const extraColumns = allColumns.filter(c => !priorityColumns.includes(c) || hideFromPriority.includes(c));

  const totalRows = meta?.totalRows || data.length;
  // Fallback for timestamp
  const timestamp = meta?.timestamp || meta?.extracted_at || (data[0] as any)?.extracted_at;

  return (
    <div className="flex flex-col h-full">
      {/* Tool Bar: Stats & Search */}
      <div className="flex flex-col md:flex-row gap-4 p-4 bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800 items-start md:items-center">
        <div className="flex gap-6">
          <div className="flex flex-col">
            <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider font-bold">總筆數 / 篩選後</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-50 text-sm">
              {data.length} <span className="text-zinc-400 font-normal">/</span> {filteredData.length}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider font-bold">資料時間 / 狀態</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-50 text-sm truncate max-w-[150px]" title={timestamp}>
              {timestamp ? new Date(timestamp).toLocaleString('zh-TW') : "最新整合"}
            </span>
          </div>
        </div>

        {showSearch && (
          <div className="flex-1 w-full md:max-w-md relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-zinc-400 text-xs">🔍</span>
            </div>
            <input
              type="text"
              placeholder="全域搜尋 (案號、案名、聯絡人、備註...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-all shadow-sm"
            />
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="overflow-auto max-h-[600px] relative scrollbar-thin">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 shadow-sm">
              {columns.map((col) => (
                <th key={col} className="px-4 py-3 whitespace-nowrap bg-zinc-100 dark:bg-zinc-800">{col}</th>
              ))}
              {isExpanded && extraColumns.map(col => (
                <th key={col} className="px-4 py-3 whitespace-nowrap bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 italic">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredData.length > 0 ? (
              filteredData.map((row, idx) => (
                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-950/30 transition-colors">
                  {columns.map((col) => (
                    <td 
                      key={col} 
                      className={`px-4 py-2.5 text-zinc-700 dark:text-zinc-300 max-w-[400px] leading-relaxed ${
                        col === '備註' ? 'whitespace-pre-wrap font-sans text-[10px] min-w-[200px]' : 'truncate'
                      }`}
                    >
                      {row[col] === null || row[col] === "" ? <span className="text-zinc-300 dark:text-zinc-700">-</span> : String(row[col])}
                    </td>
                  ))}
                  {isExpanded && extraColumns.map(col => (
                    <td key={col} className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400 max-w-[300px] truncate bg-zinc-50/20 dark:bg-zinc-900/20 italic text-[10px]">
                      {String(row[col])}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + (isExpanded ? extraColumns.length : 0)} className="p-12 text-center text-zinc-400 italic">
                  找不到符合 "{searchTerm}" 的結果
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Expand */}
      <div className="p-3 bg-white dark:bg-zinc-900 flex justify-between items-center border-t border-zinc-200 dark:border-zinc-800">
        <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-medium">
          顯示 {filteredData.length} 筆資料 (備註已整合)
        </p>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[11px] font-bold px-3 py-1 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors uppercase tracking-tight"
        >
          {isExpanded ? "隱藏原始欄位" : "顯示所有隱藏欄位 (含拆分備註)"}
        </button>
      </div>
    </div>
  );
}
