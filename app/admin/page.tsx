/**
 * Admin Console (管理台)
 * Multi-layer Tabbed Structure
 */

import fs from "fs/promises";
import path from "path";
import AdminTabs from "./admin-tabs";

async function getRawData(filePath: string) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(fullPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return null;
  }
}

export default async function AdminPage() {
  const [sitesData, reportsData, contactsData] = await Promise.all([
    getRawData("maintenance-probe/probe-output/console/north-sites-master.json"),
    getRawData("maintenance-probe/probe-output/console/north-reports.normalized.json"),
    getRawData("maintenance-probe/probe-output/console/north-contacts.normalized.json")
  ]);

  return (
    <div className="container mx-auto max-w-6xl p-6 pb-20">
      <div className="flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-sans italic">管理台</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            工程系統行政管理中心：提供原始資料校閱與權限配置入口。
          </p>
        </div>

        {/* Tabbed Navigation & Content Container */}
        <AdminTabs 
          sitesData={sitesData} 
          reportsData={reportsData} 
          contactsData={contactsData}
        />
      </div>
    </div>
  );
}
