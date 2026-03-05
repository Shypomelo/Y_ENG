"use client";

import { useState } from "react";
import { useProjects, PeopleByDept, VendorsByType } from "../providers/projects-store";

export default function SettingsPage() {
    const {
        peopleByDept,
        vendorsByType,
        addPerson, removePerson,
        addVendor, removeVendor
    } = useProjects();

    const [newPerson, setNewPerson] = useState<Record<string, string>>({});
    const [newVendor, setNewVendor] = useState<Record<string, string>>({});

    const handleAddPerson = (dept: keyof PeopleByDept) => {
        const name = newPerson[dept]?.trim();
        if (!name) return;
        addPerson(dept, name);
        setNewPerson(prev => ({ ...prev, [dept]: "" }));
    };

    const handleRemovePerson = (dept: keyof PeopleByDept, name: string) => {
        removePerson(dept, name);
    };

    const handleAddVendor = (type: keyof VendorsByType) => {
        const name = newVendor[type]?.trim();
        if (!name) return;
        addVendor(type, name);
        setNewVendor(prev => ({ ...prev, [type]: "" }));
    };

    const handleRemoveVendor = (type: keyof VendorsByType, name: string) => {
        removeVendor(type, name);
    };

    return (
        <div className="container mx-auto max-w-5xl p-6 sm:p-10 space-y-12">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">名單管理</h1>
                <p className="text-zinc-500 dark:text-zinc-400">管理各部門人員與包商名單，將自動對應至建立專案及流程中的選單。</p>
            </div>

            {/* 人員管理 */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">人員名單（按部門）</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(Object.keys(peopleByDept) as Array<keyof PeopleByDept>).map(dept => (
                        <div key={dept} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col overflow-hidden">
                            <div className="px-5 py-4 bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                                <span className="font-bold text-zinc-900 dark:text-zinc-100">{dept}</span>
                                <span className="text-xs font-medium px-2 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-full">
                                    {peopleByDept[dept].length} 人
                                </span>
                            </div>
                            <div className="p-5 flex-1 space-y-4">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="新增姓名..."
                                        className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                        value={newPerson[dept] || ""}
                                        onChange={(e) => setNewPerson(prev => ({ ...prev, [dept]: e.target.value }))}
                                        onKeyDown={(e) => e.key === "Enter" && handleAddPerson(dept)}
                                    />
                                    <button
                                        onClick={() => handleAddPerson(dept)}
                                        className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="space-y-1 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-700">
                                    {peopleByDept[dept].map(name => (
                                        <div key={name} className="group flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                                            <span className="text-sm text-zinc-700 dark:text-zinc-300">{name}</span>
                                            <button
                                                onClick={() => handleRemovePerson(dept, name)}
                                                className="p-1 text-zinc-400 hover:text-red-500 transition-all pointer-events-auto"
                                                title="刪除"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                    {peopleByDept[dept].length === 0 && (
                                        <div className="py-8 text-center text-zinc-400 text-xs italic">尚無名單</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 包商管理 */}
            <section className="space-y-6">
                <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-10V4a1 1 0 011-1h2a1 1 0 011 1v3M12 21v-4a1 1 0 011-1h2a1 1 0 011 1v4" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">包商名單（按類別）</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(Object.keys(vendorsByType) as Array<keyof VendorsByType>).map(type => (
                        <div key={type} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col overflow-hidden">
                            <div className="px-5 py-4 bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                                <span className="font-bold text-zinc-900 dark:text-zinc-100">{type}</span>
                                <span className="text-xs font-medium px-2 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-full">
                                    {vendorsByType[type].length} 家
                                </span>
                            </div>
                            <div className="p-5 flex-1 space-y-4">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="新增包商..."
                                        className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                        value={newVendor[type] || ""}
                                        onChange={(e) => setNewVendor(prev => ({ ...prev, [type]: e.target.value }))}
                                        onKeyDown={(e) => e.key === "Enter" && handleAddVendor(type)}
                                    />
                                    <button
                                        onClick={() => handleAddVendor(type)}
                                        className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="space-y-1 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-700">
                                    {vendorsByType[type].map(name => (
                                        <div key={name} className="group flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                                            <span className="text-sm text-zinc-700 dark:text-zinc-300">{name}</span>
                                            <button
                                                onClick={() => handleRemoveVendor(type, name)}
                                                className="p-1 text-zinc-400 hover:text-red-500 transition-all pointer-events-auto"
                                                title="刪除"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                    {vendorsByType[type].length === 0 && (
                                        <div className="py-8 text-center text-zinc-400 text-xs italic">尚無名單</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
