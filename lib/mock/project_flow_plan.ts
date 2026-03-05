import { flowTemplate } from "./flow_template";

export type DateCorrectionLog = {
    id: string;
    step_id: string;
    field: "actual_end" | "baseline_planned_end" | "current_planned_end";
    before: string;
    after: string;
    corrected_at: string;
    corrected_by: string;
    note?: string;
};

export type ProjectFlowStepPlan = {
    id: string; // P-002..P-008
    name: string;
    lane: "工程" | "專案" | "採購" | "業務";
    offset_days: number;
    baseline_planned_end: string; // YYYY-MM-DD
    current_planned_end: string;  // YYYY-MM-DD
    status: "未開始" | "進行中" | "完成" | "卡關"; // UI mock
    delay_override?: boolean;
    delay_reason?: string;
    actual_end?: string;
    delay_days?: number;
    updated_at: string;
    corrections?: DateCorrectionLog[];
};

export type ProjectFlowPlan = {
    project_id: string;
    project_name: string;
    start_date: string;
    project_status: "進行中" | "已結案";
    kWp: number;
    isImportant: boolean;
    owners?: {
        engineering?: string;
        pm?: string;
        structural?: string;
        admin?: string;
        sales?: string;
    };
    enginePlan?: {
        entry_date?: string;
        items: Array<{
            key: string;
            entered: boolean;
            done: boolean;
        }>;
    };
    procureGroups?: Array<{
        id: string;
        items: string[];
        status: "待請購" | "已請購" | "已到貨" | "缺料";
        eta_date?: string;
        actual_date?: string;
        note?: string;
        date_mode?: "eta" | "actual";
    }>;
    steps: ProjectFlowStepPlan[];
};

function addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
}

export function createProjectFlowPlan(
    project_id: string,
    project_name: string,
    start_date: string,
    kWp: number = Math.floor(Math.random() * 200) + 10,
    owners?: ProjectFlowPlan["owners"]
): ProjectFlowPlan {
    const coreFlows = flowTemplate.filter(node => node.is_core);
    const steps: ProjectFlowStepPlan[] = coreFlows.map((node, index) => {
        return {
            id: node.id,
            name: node.name,
            lane: node.lane,
            offset_days: node.offset_days,
            baseline_planned_end: addDays(start_date, node.offset_days),
            current_planned_end: addDays(start_date, node.offset_days),
            status: index === 0 ? "進行中" : "未開始",
            updated_at: new Date().toISOString()
        };
    });

    return {
        project_id,
        project_name,
        start_date,
        project_status: "進行中",
        kWp,
        isImportant: false,
        owners,
        steps
    };
}
