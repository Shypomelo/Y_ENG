"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { ProjectFlowPlan, createProjectFlowPlan } from "../../lib/mock/project_flow_plan";

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


type ProjectsContextType = {
    projects: ProjectFlowPlan[];
    setProjects: React.Dispatch<React.SetStateAction<ProjectFlowPlan[]>>;
    updateProject: (projectId: string, patch: Partial<ProjectFlowPlan>) => void;
};

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export function ProjectsProvider({ children }: { children: ReactNode }) {
    const [projects, setProjects] = useState<ProjectFlowPlan[]>(INITIAL_GLOBAL_PROJECTS);

    const updateProject = (projectId: string, patch: Partial<ProjectFlowPlan>) => {
        setProjects(prev => prev.map(p => p.project_id === projectId ? { ...p, ...patch } : p));
    };

    return (
        <ProjectsContext.Provider value={{ projects, setProjects, updateProject }}>
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
