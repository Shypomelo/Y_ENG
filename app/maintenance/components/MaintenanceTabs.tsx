"use client";

import { type ReactNode } from "react";

interface MaintenanceTabsProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    tabs: { id: string; label: string }[];
}

export default function MaintenanceTabs({ activeTab, onTabChange, tabs }: MaintenanceTabsProps) {
    return (
        <div className="flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 mb-6 shrink-0 no-scrollbar">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`whitespace-nowrap py-3 px-5 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                        ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10 rounded-t-lg"
                        : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300 dark:hover:border-zinc-700"
                        }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
