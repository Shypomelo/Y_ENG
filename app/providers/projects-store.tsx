"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { ProjectFlowPlan, createProjectFlowPlan } from "../../lib/mock/project_flow_plan";
import { flowTemplate, FlowNode } from "../../lib/mock/flow_template";
import { departmentFlows, DeptCode, DepartmentFlow, Dept } from "../../lib/mock/department_flows";

// Supabase Repositories
import * as staffRepo from "../../lib/repositories/staff";
import * as vendorRepo from "../../lib/repositories/vendors";
import * as flowsRepo from "../../lib/repositories/flows";
import * as projectsRepo from "../../lib/repositories/projects";

export type PeopleByDept = {
    "工程": { id: string, name: string }[];
    "專案": { id: string, name: string }[];
    "業務": { id: string, name: string }[];
    "結構": { id: string, name: string }[];
    "行政": { id: string, name: string }[];
};

export type VendorsByType = {
    "鋼構": { id: string, name: string }[];
    "電力": { id: string, name: string }[];
    "爬梯": { id: string, name: string }[];
    "土木": { id: string, name: string }[];
    "清洗": { id: string, name: string }[];
};

const INITIAL_PEOPLE: PeopleByDept = {
    "工程": [],
    "專案": [],
    "業務": [],
    "結構": [],
    "行政": []
};

const INITIAL_VENDORS: VendorsByType = {
    "鋼構": [],
    "電力": [],
    "爬梯": [],
    "土木": [],
    "清洗": []
};

type ProjectsContextType = {
    projects: ProjectFlowPlan[];
    setProjects: React.Dispatch<React.SetStateAction<ProjectFlowPlan[]>>;
    updateProject: (projectId: string, patch: Partial<ProjectFlowPlan>) => void;
    // Personnel & Vendor Management
    peopleByDept: PeopleByDept;
    setPeopleByDept: React.Dispatch<React.SetStateAction<PeopleByDept>>;
    vendorsByType: VendorsByType;
    setVendorsByType: React.Dispatch<React.SetStateAction<VendorsByType>>;
    addPerson: (dept: keyof PeopleByDept, name: string) => Promise<void>;
    removePerson: (dept: keyof PeopleByDept, id: string) => Promise<void>;
    addVendor: (type: keyof VendorsByType, name: string) => Promise<void>;
    removeVendor: (type: keyof VendorsByType, id: string) => Promise<void>;
    // Flow Persistence
    flowTemplateOrder: FlowNode[];
    setFlowTemplateOrder: React.Dispatch<React.SetStateAction<FlowNode[]>>;
    deptFlowConfig: Record<DeptCode, DepartmentFlow>;
    setDeptFlowConfig: React.Dispatch<React.SetStateAction<Record<DeptCode, DepartmentFlow>>>;
    isLoadingStore: boolean;
    isMounted: boolean;
};

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export function ProjectsProvider({ children }: { children: ReactNode }) {
    const [projects, setProjects] = useState<ProjectFlowPlan[]>([]);
    const [peopleByDept, setPeopleByDept] = useState<PeopleByDept>(INITIAL_PEOPLE);
    const [vendorsByType, setVendorsByType] = useState<VendorsByType>(INITIAL_VENDORS);
    const [flowTemplateOrder, setFlowTemplateOrder] = useState<FlowNode[]>(flowTemplate);
    const [deptFlowConfig, setDeptFlowConfig] = useState<Record<DeptCode, DepartmentFlow>>(departmentFlows);
    const [isLoadingStore, setIsLoadingStore] = useState(true);
    const [isMounted, setIsMounted] = useState(false);

    // Initial load from localStorage & Supabase
    useEffect(() => {
        setIsMounted(true);
        if (typeof window !== "undefined") {
            // LocalStorage Fallback for Settings & Flows
            const initLocalState = () => {
                const savedProjects = localStorage.getItem("yjob_projects_v1");
                if (savedProjects) {
                    try { setProjects(JSON.parse(savedProjects)); } catch (e) { console.error(e); }
                }

                const savedFlow = localStorage.getItem("yjob_flow_template_v1");
                if (savedFlow) {
                    try { setFlowTemplateOrder(JSON.parse(savedFlow)); } catch (e) { console.error(e); }
                }

                const savedDept = localStorage.getItem("yjob_dept_flow_config_v1");
                if (savedDept) {
                    try { setDeptFlowConfig(JSON.parse(savedDept)); } catch (e) { console.error(e); }
                }

                const savedPeople = localStorage.getItem("yjob_people_v2");
                if (savedPeople) {
                    try { setPeopleByDept(JSON.parse(savedPeople)); } catch (e) { console.error(e); }
                }

                const savedVendors = localStorage.getItem("yjob_vendors_v2");
                if (savedVendors) {
                    try { setVendorsByType(JSON.parse(savedVendors)); } catch (e) { console.error(e); }
                }
            };

            initLocalState();

            // Fetch from Supabase
            const fetchFromSupabase = async () => {
                try {
                    const [staffData, vendorData, dbFlows, dbProjects] = await Promise.all([
                        staffRepo.listStaffByDepartment(),
                        vendorRepo.listVendorsByCategory(),
                        flowsRepo.fetchAllFlowConfig(),
                        projectsRepo.listProjectsWithSteps()
                    ]);

                    // Map staff to PeopleByDept
                    const newPeople: PeopleByDept = {
                        "工程": [], "專案": [], "業務": [], "結構": [], "行政": []
                    };
                    staffData.forEach((staff: any) => {
                        if (newPeople[staff.department as keyof PeopleByDept]) {
                            newPeople[staff.department as keyof PeopleByDept].push({ id: staff.id, name: staff.name });
                        }
                    });

                    // Map vendors to VendorsByType
                    const newVendors: VendorsByType = {
                        "鋼構": [], "電力": [], "爬梯": [], "土木": [], "清洗": []
                    };
                    vendorData.forEach((vendor: any) => {
                        if (newVendors[vendor.category as keyof VendorsByType]) {
                            newVendors[vendor.category as keyof VendorsByType].push({ id: vendor.id, name: vendor.name });
                        }
                    });

                    // Map Flows
                    if (dbFlows && dbFlows.templates.length > 0 && dbFlows.steps.length > 0) {
                        const baseFlowOrder: typeof flowTemplateOrder = [];
                        const baseDeptConfig: typeof deptFlowConfig = {
                            E: { code: "E", dept: "工程", steps: [] },
                            P: { code: "P", dept: "專案", steps: [] },
                            B: { code: "B", dept: "業務", steps: [] },
                            ST: { code: "ST", dept: "結構", steps: [] },
                            A: { code: "A", dept: "行政", steps: [] }
                        };
                        const deptToCode: Record<string, keyof typeof deptFlowConfig> = {
                            "工程": "E", "專案": "P", "業務": "B", "結構": "ST", "行政": "A"
                        };

                        const tmplMap = Object.fromEntries(dbFlows.templates.map((t: any) => [t.id, t.name]));

                        dbFlows.steps.forEach((s: any) => {
                            const tmplName = tmplMap[s.template_id];
                            if (tmplName === 'Master') {
                                baseFlowOrder.push({
                                    id: s.step_key,
                                    seq: s.sort_order || 0,
                                    lane: (s.owner_role as any) || '',
                                    name: s.step_name,
                                    is_core: s.is_core ?? true,
                                    depends_on: s.depends_on || [],
                                    offset_days: s.offset_days || 0,
                                    deliverable: s.deliverable || ''
                                });
                            } else if (tmplName && deptToCode[tmplName]) {
                                baseDeptConfig[deptToCode[tmplName]].steps.push({
                                    id: s.step_key,
                                    dept: s.owner_role as Dept,
                                    name: s.step_name,
                                    depends_on: s.depends_on || [],
                                    base_offset_days: s.base_offset_days || 0,
                                    kw_tiers: s.kw_tiers || [],
                                    default_days: s.base_offset_days || 0,
                                    is_core: s.is_core ?? true
                                });
                            }
                        });

                        if (baseFlowOrder.length > 0) setFlowTemplateOrder(baseFlowOrder);

                        // Only override if DEPT config actually loaded something
                        if (Object.values(baseDeptConfig).some(d => d.steps.length > 0)) {
                            setDeptFlowConfig(baseDeptConfig);
                        }
                    }

                    // Map Projects
                    const mappedProjects: ProjectFlowPlan[] = dbProjects.map(item => ({
                        project_id: item.project.id,
                        project_name: item.project.name || "未命名案件",
                        start_date: item.project.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                        project_status: (item.project.status_flag as any) || "進行中",
                        kWp: item.project.kwp || 0,
                        isImportant: item.project.is_important || false,
                        owners: (item.project.owners as any) || {},
                        steps: item.steps.map(s => ({
                            id: s.template_step_key || s.id,
                            name: s.step_name || "未命名步驟",
                            lane: (s.owner_role as any) || "專案",
                            offset_days: (s.metadata as any)?.offset_days || 0,
                            baseline_planned_end: s.baseline_date || "",
                            current_planned_end: s.current_planned_date || "",
                            status: (s.status as any) || "未開始",
                            actual_end: s.actual_date || undefined,
                            delay_reason: s.delay_reason || undefined,
                            updated_at: s.updated_at || new Date().toISOString()
                        }))
                    }));
                    setProjects(mappedProjects);
                    localStorage.setItem("yjob_projects_v1", JSON.stringify(mappedProjects));

                    // Update States
                    setPeopleByDept(newPeople);
                    setVendorsByType(newVendors);

                    // Update LocalStorage
                    localStorage.setItem("yjob_people_v2", JSON.stringify(newPeople));
                    localStorage.setItem("yjob_vendors_v2", JSON.stringify(newVendors));

                } catch (e) {
                    const error = e as any;
                    console.error("Failed to load settings data from Supabase", {
                        message: error?.message,
                        details: error?.details,
                        hint: error?.hint,
                        code: error?.code,
                        status: error?.status,
                    });
                    // Use localStorage data inherently by not overriding
                } finally {
                    setIsLoadingStore(false);
                }
            };

            fetchFromSupabase();
        }
    }, []);

    // Save to localStorage when flow changes
    useEffect(() => {
        if (typeof window !== "undefined" && !isLoadingStore) {
            localStorage.setItem("yjob_flow_template_v1", JSON.stringify(flowTemplateOrder));
        }
    }, [flowTemplateOrder, isLoadingStore]);

    useEffect(() => {
        if (typeof window !== "undefined" && !isLoadingStore) {
            localStorage.setItem("yjob_dept_flow_config_v1", JSON.stringify(deptFlowConfig));
        }
    }, [deptFlowConfig, isLoadingStore]);

    // Initial loaded tracking
    const [initialSyncDone, setInitialSyncDone] = useState(false);
    useEffect(() => {
        if (!isLoadingStore) {
            // Do not sync down to DB immediately if we haven't given it a moment.
            // Helps prevent overwriting the DB with mock localstorage on first mount.
            const t = setTimeout(() => setInitialSyncDone(true), 2000);
            return () => clearTimeout(t);
        }
    }, [isLoadingStore]);

    // Debounced sync to Supabase for Flows
    useEffect(() => {
        if (!isLoadingStore && initialSyncDone && typeof window !== "undefined") {
            const timer = setTimeout(() => {
                flowsRepo.syncAllFlowConfig(flowTemplateOrder, deptFlowConfig)
                    .catch((error: any) => console.error("Debounced sync failed", {
                        message: error?.message,
                        details: error?.details,
                        hint: error?.hint,
                        code: error?.code,
                        status: error?.status,
                    }));
            }, 3000); // 3 秒 debounce
            return () => clearTimeout(timer);
        }
    }, [flowTemplateOrder, deptFlowConfig, isLoadingStore, initialSyncDone]);

    const updateProject = (projectId: string, patch: Partial<ProjectFlowPlan>) => {
        setProjects(prev => prev.map(p => p.project_id === projectId ? { ...p, ...patch } : p));
    };

    const addPerson = async (dept: keyof PeopleByDept, name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) return;

        try {
            // Write to Supabase
            const newStaff = await staffRepo.createStaff(trimmedName, dept);

            // Update UI & LocalStorage
            setPeopleByDept(prev => {
                const updated = {
                    ...prev,
                    [dept]: [...prev[dept], { id: newStaff.id, name: newStaff.name }]
                };
                if (typeof window !== "undefined") {
                    localStorage.setItem("yjob_people_v2", JSON.stringify(updated));
                }
                return updated;
            });
        } catch (e) {
            const error = e as any;
            console.error("Failed to add person to Supabase", {
                message: error?.message,
                details: error?.details,
                hint: error?.hint,
                code: error?.code,
                status: error?.status,
            });
        }
    };

    const removePerson = async (dept: keyof PeopleByDept, id: string) => {
        try {
            // Delete from Supabase
            await staffRepo.deleteStaff(id);

            // Update UI & LocalStorage
            setPeopleByDept(prev => {
                const updated = {
                    ...prev,
                    [dept]: prev[dept].filter(p => p.id !== id)
                };
                if (typeof window !== "undefined") {
                    localStorage.setItem("yjob_people_v2", JSON.stringify(updated));
                }
                return updated;
            });
        } catch (e) {
            const error = e as any;
            console.error("Failed to remove person from Supabase", {
                message: error?.message,
                details: error?.details,
                hint: error?.hint,
                code: error?.code,
                status: error?.status,
            });
        }
    };

    const addVendor = async (type: keyof VendorsByType, name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) return;

        try {
            // Write to Supabase
            const newVendorData = await vendorRepo.createVendor(trimmedName, type);

            // Update UI & LocalStorage
            setVendorsByType(prev => {
                const updated = {
                    ...prev,
                    [type]: [...prev[type], { id: newVendorData.id, name: newVendorData.name }]
                };
                if (typeof window !== "undefined") {
                    localStorage.setItem("yjob_vendors_v2", JSON.stringify(updated));
                }
                return updated;
            });
        } catch (e) {
            const error = e as any;
            console.error("Failed to add vendor to Supabase", {
                message: error?.message,
                details: error?.details,
                hint: error?.hint,
                code: error?.code,
                status: error?.status,
            });
        }
    };

    const removeVendor = async (type: keyof VendorsByType, id: string) => {
        try {
            // Delete from Supabase
            await vendorRepo.deleteVendor(id);

            // Update UI & LocalStorage
            setVendorsByType(prev => {
                const updated = {
                    ...prev,
                    [type]: prev[type].filter(v => v.id !== id)
                };
                if (typeof window !== "undefined") {
                    localStorage.setItem("yjob_vendors_v2", JSON.stringify(updated));
                }
                return updated;
            });
        } catch (e) {
            const error = e as any;
            console.error("Failed to remove vendor from Supabase", {
                message: error?.message,
                details: error?.details,
                hint: error?.hint,
                code: error?.code,
                status: error?.status,
            });
        }
    };

    return (
        <ProjectsContext.Provider value={{
            projects, setProjects, updateProject,
            peopleByDept, setPeopleByDept,
            vendorsByType, setVendorsByType,
            addPerson, removePerson, addVendor, removeVendor,
            flowTemplateOrder, setFlowTemplateOrder,
            deptFlowConfig, setDeptFlowConfig,
            isLoadingStore, isMounted
        }}>
            {children}
        </ProjectsContext.Provider>
    );
}

export function useProjects() {
    const context = useContext(ProjectsContext);
    if (context === undefined) {
        throw new Error("useProjects must be used within a ProjectsProvider");
    }
    return context;
}
