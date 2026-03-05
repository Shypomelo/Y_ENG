"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { ProjectFlowPlan, createProjectFlowPlan } from "../../lib/mock/project_flow_plan";
import { flowTemplate, FlowNode } from "../../lib/mock/flow_template";
import { departmentFlows, DeptCode, DepartmentFlow } from "../../lib/mock/department_flows";
import { useEffect } from "react";

// Initial Mock Data (Moved here so it's global)
const INITIAL_GLOBAL_PROJECTS: ProjectFlowPlan[] = [
    createProjectFlowPlan("P001", "台北總部辦公室裝修工程", "2024-03-01", 150, { engineering: "王大明", pm: "李小華" }),
    createProjectFlowPlan("P002", "台中分公司廠房擴建", "2024-04-15", 300, { engineering: "陳阿信", pm: "林佳玲" }),
    createProjectFlowPlan("P003", "聯華觀音二期太陽能", "2025-11-20", 500, { engineering: "張建國", structural: "吳明雄" }),
    createProjectFlowPlan("P004", "高雄物流中心改建", "2026-06-10"),
];

// Apply same mock completion for P001
INITIAL_GLOBAL_PROJECTS[0].steps.forEach((step, idx) => {
    if (idx < 5) step.status = "完成";
    else if (idx === 5) step.status = "進行中";
});
INITIAL_GLOBAL_PROJECTS[1].steps[0].status = "完成";
INITIAL_GLOBAL_PROJECTS[1].steps[1].status = "進行中";
INITIAL_GLOBAL_PROJECTS[1].steps[0].actual_end = "2024-04-20";

INITIAL_GLOBAL_PROJECTS[2].steps[0].delay_override = true;
INITIAL_GLOBAL_PROJECTS[2].steps[0].delay_reason = "業主變更設計，暫停進場";
INITIAL_GLOBAL_PROJECTS[2].steps[0].status = "卡關";

INITIAL_GLOBAL_PROJECTS[3].project_status = "已結案";
INITIAL_GLOBAL_PROJECTS[3].steps.forEach(s => s.status = "完成");


export type PeopleByDept = {
    "工程": string[];
    "專案": string[];
    "業務": string[];
    "結構": string[];
    "行政": string[];
};

export type VendorsByType = {
    "鋼構": string[];
    "電力": string[];
    "爬梯": string[];
    "土木": string[];
    "清洗": string[];
};

const INITIAL_PEOPLE: PeopleByDept = {
    "工程": ["王大明", "陳阿信", "張建國"],
    "專案": ["李小華", "林佳玲"],
    "業務": ["陳業務"],
    "結構": [],
    "行政": []
};

const INITIAL_VENDORS: VendorsByType = {
    "鋼構": ["大鋼構公司", "強森鋼構"],
    "電力": ["台電合作社", "明亮電力"],
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
    addPerson: (dept: keyof PeopleByDept, name: string) => void;
    removePerson: (dept: keyof PeopleByDept, name: string) => void;
    addVendor: (type: keyof VendorsByType, name: string) => void;
    removeVendor: (type: keyof VendorsByType, name: string) => void;
    // Flow Persistence
    flowTemplateOrder: FlowNode[];
    setFlowTemplateOrder: React.Dispatch<React.SetStateAction<FlowNode[]>>;
    deptFlowConfig: Record<DeptCode, DepartmentFlow>;
    setDeptFlowConfig: React.Dispatch<React.SetStateAction<Record<DeptCode, DepartmentFlow>>>;
};

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export function ProjectsProvider({ children }: { children: ReactNode }) {
    const [projects, setProjects] = useState<ProjectFlowPlan[]>(INITIAL_GLOBAL_PROJECTS);
    const [peopleByDept, setPeopleByDept] = useState<PeopleByDept>(INITIAL_PEOPLE);
    const [vendorsByType, setVendorsByType] = useState<VendorsByType>(INITIAL_VENDORS);
    const [flowTemplateOrder, setFlowTemplateOrder] = useState<FlowNode[]>(flowTemplate);
    const [deptFlowConfig, setDeptFlowConfig] = useState<Record<DeptCode, DepartmentFlow>>(departmentFlows);

    // Initial load from localStorage
    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedFlow = localStorage.getItem("yjob_flow_template_v1");
            if (savedFlow) {
                try {
                    setFlowTemplateOrder(JSON.parse(savedFlow));
                } catch (e) {
                    console.error("Failed to parse flowTemplateOrder from localStorage", e);
                }
            }

            const savedDept = localStorage.getItem("yjob_dept_flow_config_v1");
            if (savedDept) {
                try {
                    setDeptFlowConfig(JSON.parse(savedDept));
                } catch (e) {
                    console.error("Failed to parse deptFlowConfig from localStorage", e);
                }
            }
        }
    }, []);

    // Save to localStorage when state changes
    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("yjob_flow_template_v1", JSON.stringify(flowTemplateOrder));
        }
    }, [flowTemplateOrder]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("yjob_dept_flow_config_v1", JSON.stringify(deptFlowConfig));
        }
    }, [deptFlowConfig]);

    const updateProject = (projectId: string, patch: Partial<ProjectFlowPlan>) => {
        setProjects(prev => prev.map(p => p.project_id === projectId ? { ...p, ...patch } : p));
    };

    const addPerson = (dept: keyof PeopleByDept, name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) return;
        setPeopleByDept(prev => {
            if (prev[dept].includes(trimmedName)) return prev;
            return { ...prev, [dept]: [...prev[dept], trimmedName] };
        });
    };

    const removePerson = (dept: keyof PeopleByDept, name: string) => {
        setPeopleByDept(prev => ({
            ...prev,
            [dept]: prev[dept].filter(n => n !== name)
        }));
    };

    const addVendor = (type: keyof VendorsByType, name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) return;
        setVendorsByType(prev => {
            if (prev[type].includes(trimmedName)) return prev;
            return { ...prev, [type]: [...prev[type], trimmedName] };
        });
    };

    const removeVendor = (type: keyof VendorsByType, name: string) => {
        setVendorsByType(prev => ({
            ...prev,
            [type]: prev[type].filter(n => n !== name)
        }));
    };

    return (
        <ProjectsContext.Provider value={{
            projects, setProjects, updateProject,
            peopleByDept, setPeopleByDept,
            vendorsByType, setVendorsByType,
            addPerson, removePerson, addVendor, removeVendor,
            flowTemplateOrder, setFlowTemplateOrder,
            deptFlowConfig, setDeptFlowConfig
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
