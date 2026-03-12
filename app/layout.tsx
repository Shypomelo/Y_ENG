import Link from "next/link";
import { type ReactNode } from "react";
import "./globals.css";
import { ProjectsProvider } from "./providers/projects-store";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <body className="antialiased font-sans">
        <ProjectsProvider>
          <div className="flex flex-col min-h-screen">
            <header className="sticky top-0 z-50 w-full border-b bg-white dark:bg-zinc-950">
              <div className="container mx-auto max-w-5xl flex h-14 items-center gap-6 px-4 sm:px-6">
                <Link href="/" className="font-bold text-lg">工程系統</Link>
                <nav className="flex items-center gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400 sm:gap-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
                  <Link href="/" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-50">首頁</Link>
                  <Link href="/schedule" className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors">排程</Link>
                  <Link href="/projects" className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors">專案狀態</Link>
                  <Link href="/maintenance" className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors">維運工單</Link>
                  <Link href="/reports" className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors">報表</Link>
                  <Link href="/flow" className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors">流程</Link>
                  <Link href="/settings" className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors">設定</Link>
                </nav>
              </div>
            </header>
            <main className="flex-1">
              {children}
            </main>
          </div>
        </ProjectsProvider>
      </body>
    </html>
  );
}

