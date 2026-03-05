import { FlowNode, flowTemplate } from "./flow_template";
import { DeptCode, DepartmentFlow, Dept } from "./department_flows";

const MAPPING: Record<string, string> = {
    // 專案 (P)
    "T23": "P-001",
    "T01": "P-002",
    "T05": "P-003",
    "T07": "P-004",
    "T10": "P-005",
    "T14": "P-006",
    "T19": "P-007",
    "T20": "P-008",
    // 業務 (B)
    "T02": "B-001",
    "T03": "B-002",
    "T08": "B-003",
    "T09": "B-004",
    // 工程 (E)
    "T04": "E-001",
    "T06": "E-002",
    "T13": "E-003",
    "T16": "E-004",
    "T17": "E-005",
    "T18": "E-006",
    "T21": "E-007",
    "T22": "E-008",
    // 採購 (S)
    "T11": "S-001",
    "T12": "S-002",
    "T15": "S-003",
};

export function migrateFlowTemplateToDepartmentFlows(flows: FlowNode[]): Record<DeptCode, DepartmentFlow> {
    const result: Record<DeptCode, DepartmentFlow> = {
        "E": { dept: "工程", code: "E", steps: [] },
        "P": { dept: "專案", code: "P", steps: [] },
        "A": { dept: "行政", code: "A", steps: [] },
        "B": { dept: "業務", code: "B", steps: [] },
        "ST": { dept: "結構", code: "ST", steps: [] },
    };

    const getCode = (lane: string): DeptCode => {
        if (lane === "工程") return "E";
        if (lane === "專案") return "P";
        if (lane === "行政") return "A";
        if (lane === "結構") return "ST";
        return "B";
    };

    flows.forEach(node => {
        const newId = MAPPING[node.id];
        if (!newId) return;

        const deptCode = getCode(node.lane);

        result[deptCode].steps.push({
            id: newId,
            dept: node.lane as Dept,
            name: node.name,
            depends_on: node.depends_on.map(oldId => MAPPING[oldId] || oldId),
            base_offset_days: node.offset_days,
            is_core: node.is_core,
        });
    });

    // Sort steps by ID within each department
    Object.values(result).forEach(deptFlow => {
        deptFlow.steps.sort((a, b) => a.id.localeCompare(b.id));
    });

    return result;
}
