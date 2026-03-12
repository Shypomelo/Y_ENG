import Link from "next/link";
import { type ReactNode } from "react";

export default function Home() {
  return (
    <div className="container mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">

      {/* 標題區塊 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          工程系統
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          頁面優先版 MVP
        </p>
      </div>

      {/* 4 張入口卡片網格 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">

        {/* 1. 排程 */}
        <Link href="/schedule" className="group flex flex-col justify-between rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 transition-all hover:shadow-md hover:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-700">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                排程
              </h2>
              <svg className="h-5 w-5 text-zinc-400 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">3</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">今日事件</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">12</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">本週事件</span>
              </div>
            </div>
          </div>
        </Link>

        {/* 2. 專案狀態 */}
        <Link href="/projects" className="group flex flex-col justify-between rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 transition-all hover:shadow-md hover:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-700">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                專案狀態
              </h2>
              <svg className="h-5 w-5 text-zinc-400 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">8</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">重點數</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">2</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">延誤數</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-amber-500 dark:text-amber-400">5</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">風險數</span>
              </div>
            </div>
          </div>
        </Link>

        {/* 3. 維運工單 */}
        <Link href="/maintenance" className="group flex flex-col justify-between rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 transition-all hover:shadow-md hover:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-700">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                維運工單
              </h2>
              <svg className="h-5 w-5 text-zinc-400 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">14</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">待處理</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">1</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">逾期</span>
              </div>
            </div>
          </div>
        </Link>

        {/* 4. 報表 */}
        <Link href="/reports" className="group flex flex-col justify-between rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 transition-all hover:shadow-md hover:ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-zinc-700">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                報表
              </h2>
              <svg className="h-5 w-5 text-zinc-400 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="flex flex-col mt-2">
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Sheets 同步狀態：</span>
              <span className="mt-1 text-sm font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded-md w-fit">
                尚未串接
              </span>
            </div>
          </div>
        </Link>

      </div>
    </div>
  );
}
