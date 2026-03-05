export type Dept = "工程" | "專案" | "採購" | "業務";
export type DeptCode = "E" | "P" | "S" | "B";

export type DeptStep = {
    id: string;
    dept: Dept;
    name: string;
    depends_on: string[];
    base_offset_days?: number; // retained for backward compatibility / fallback
    kw_tiers?: Array<{ maxKW: number; days: number }>;
    default_days?: number;
    kw_rule?: {
        mode: "tier" | "multiplier";
        tiers?: Array<{ minKW: number; maxKW: number; offsetDays: number }>;
        multiplier?: number;
    };
    is_core?: boolean;
};

export function getDaysByKW(step: DeptStep, kw: number): number {
    if (step.kw_tiers && step.kw_tiers.length > 0) {
        // Assume kw_tiers is sorted by maxKW ascending
        const tier = step.kw_tiers.find(t => kw <= t.maxKW);
        if (tier) return tier.days;
    }
    return step.default_days ?? step.base_offset_days ?? 0;
}

export type DepartmentFlow = {
    dept: Dept;
    code: DeptCode;
    steps: DeptStep[];
};

export const departmentFlows: Record<DeptCode, DepartmentFlow> = {
    "E": {
        "dept": "工程",
        "code": "E",
        "steps": [
            {
                "id": "E-001",
                "dept": "工程",
                "name": "現勘紀錄回收",
                "depends_on": [
                    "B-002"
                ],
                "base_offset_days": 6,
                "kw_tiers": [
                    { "maxKW": 20, "days": 6 },
                    { "maxKW": 100, "days": 6 },
                    { "maxKW": 300, "days": 6 },
                    { "maxKW": 500, "days": 6 },
                    { "maxKW": 999999, "days": 6 }
                ],
                "is_core": true
            },
            {
                "id": "E-002",
                "dept": "工程",
                "name": "設計輸入/深化",
                "depends_on": [
                    "E-001"
                ],
                "base_offset_days": 10,
                "kw_tiers": [
                    { "maxKW": 20, "days": 10 },
                    { "maxKW": 100, "days": 10 },
                    { "maxKW": 300, "days": 10 },
                    { "maxKW": 500, "days": 10 },
                    { "maxKW": 999999, "days": 10 }
                ],
                "is_core": true
            },
            {
                "id": "E-003",
                "dept": "工程",
                "name": "開工清單/施工計畫",
                "depends_on": [
                    "P-005"
                ],
                "base_offset_days": 24,
                "kw_tiers": [
                    { "maxKW": 20, "days": 24 },
                    { "maxKW": 100, "days": 24 },
                    { "maxKW": 300, "days": 24 },
                    { "maxKW": 500, "days": 24 },
                    { "maxKW": 999999, "days": 24 }
                ],
                "is_core": true
            },
            {
                "id": "E-004",
                "dept": "工程",
                "name": "進場施工",
                "depends_on": [
                    "P-006",
                    "S-003"
                ],
                "base_offset_days": 30,
                "kw_tiers": [
                    { "maxKW": 20, "days": 30 },
                    { "maxKW": 100, "days": 30 },
                    { "maxKW": 300, "days": 30 },
                    { "maxKW": 500, "days": 30 },
                    { "maxKW": 999999, "days": 30 }
                ],
                "is_core": true
            },
            {
                "id": "E-005",
                "dept": "工程",
                "name": "施工完成與分段驗收",
                "depends_on": [
                    "E-004"
                ],
                "base_offset_days": 32,
                "kw_tiers": [
                    { "maxKW": 20, "days": 32 },
                    { "maxKW": 100, "days": 32 },
                    { "maxKW": 300, "days": 32 },
                    { "maxKW": 500, "days": 32 },
                    { "maxKW": 999999, "days": 32 }
                ],
                "is_core": true
            },
            {
                "id": "E-006",
                "dept": "工程",
                "name": "測試/試運轉",
                "depends_on": [
                    "E-005"
                ],
                "base_offset_days": 34,
                "kw_tiers": [
                    { "maxKW": 20, "days": 34 },
                    { "maxKW": 100, "days": 34 },
                    { "maxKW": 300, "days": 34 },
                    { "maxKW": 500, "days": 34 },
                    { "maxKW": 999999, "days": 34 }
                ],
                "is_core": true
            },
            {
                "id": "E-007",
                "dept": "工程",
                "name": "預埋螺栓",
                "depends_on": [
                    "P-005"
                ],
                "base_offset_days": 21,
                "kw_tiers": [
                    { "maxKW": 20, "days": 21 },
                    { "maxKW": 100, "days": 21 },
                    { "maxKW": 300, "days": 21 },
                    { "maxKW": 500, "days": 21 },
                    { "maxKW": 999999, "days": 21 }
                ],
                "is_core": false
            },
            {
                "id": "E-008",
                "dept": "工程",
                "name": "舊設備拆除清運",
                "depends_on": [
                    "P-006"
                ],
                "base_offset_days": 27,
                "kw_tiers": [
                    { "maxKW": 20, "days": 27 },
                    { "maxKW": 100, "days": 27 },
                    { "maxKW": 300, "days": 27 },
                    { "maxKW": 500, "days": 27 },
                    { "maxKW": 999999, "days": 27 }
                ],
                "is_core": false
            }
        ]
    },
    "P": {
        "dept": "專案",
        "code": "P",
        "steps": [
            {
                "id": "P-001",
                "dept": "專案",
                "name": "審查意見書取得",
                "depends_on": [],
                "base_offset_days": -10,
                "kw_tiers": [
                    { "maxKW": 20, "days": -10 },
                    { "maxKW": 100, "days": -10 },
                    { "maxKW": 300, "days": -10 },
                    { "maxKW": 500, "days": -10 },
                    { "maxKW": 999999, "days": -10 }
                ],
                "is_core": true
            },
            {
                "id": "P-002",
                "dept": "專案",
                "name": "開案建立",
                "depends_on": [
                    "P-001"
                ],
                "base_offset_days": 0,
                "kw_tiers": [
                    { "maxKW": 20, "days": 0 },
                    { "maxKW": 100, "days": 0 },
                    { "maxKW": 300, "days": 0 },
                    { "maxKW": 500, "days": 0 },
                    { "maxKW": 999999, "days": 0 }
                ],
                "is_core": true
            },
            {
                "id": "P-003",
                "dept": "專案",
                "name": "初版排程/資源規劃",
                "depends_on": [
                    "P-002"
                ],
                "base_offset_days": 8,
                "kw_tiers": [
                    { "maxKW": 20, "days": 8 },
                    { "maxKW": 100, "days": 8 },
                    { "maxKW": 300, "days": 8 },
                    { "maxKW": 500, "days": 8 },
                    { "maxKW": 999999, "days": 8 }
                ],
                "is_core": true
            },
            {
                "id": "P-004",
                "dept": "專案",
                "name": "施工圖/配置初版",
                "depends_on": [
                    "E-002"
                ],
                "base_offset_days": 12,
                "kw_tiers": [
                    { "maxKW": 20, "days": 12 },
                    { "maxKW": 100, "days": 12 },
                    { "maxKW": 300, "days": 12 },
                    { "maxKW": 500, "days": 12 },
                    { "maxKW": 999999, "days": 12 }
                ],
                "is_core": true
            },
            {
                "id": "P-005",
                "dept": "專案",
                "name": "施工圖定版",
                "depends_on": [
                    "B-003",
                    "E-002"
                ],
                "base_offset_days": 18,
                "kw_tiers": [
                    { "maxKW": 20, "days": 18 },
                    { "maxKW": 100, "days": 18 },
                    { "maxKW": 300, "days": 18 },
                    { "maxKW": 500, "days": 18 },
                    { "maxKW": 999999, "days": 18 }
                ],
                "is_core": true
            },
            {
                "id": "P-006",
                "dept": "專案",
                "name": "開工會議/進場前確認",
                "depends_on": [
                    "B-004",
                    "E-003"
                ],
                "base_offset_days": 26,
                "kw_tiers": [
                    { "maxKW": 20, "days": 26 },
                    { "maxKW": 100, "days": 26 },
                    { "maxKW": 300, "days": 26 },
                    { "maxKW": 500, "days": 26 },
                    { "maxKW": 999999, "days": 26 }
                ],
                "is_core": true
            },
            {
                "id": "P-007",
                "dept": "專案",
                "name": "掛表/併網協調",
                "depends_on": [
                    "E-006"
                ],
                "base_offset_days": 36,
                "kw_tiers": [
                    { "maxKW": 20, "days": 36 },
                    { "maxKW": 100, "days": 36 },
                    { "maxKW": 300, "days": 36 },
                    { "maxKW": 500, "days": 36 },
                    { "maxKW": 999999, "days": 36 }
                ],
                "is_core": true
            },
            {
                "id": "P-008",
                "dept": "專案",
                "name": "設備登記/結案文件",
                "depends_on": [
                    "P-007"
                ],
                "base_offset_days": 38,
                "kw_tiers": [
                    { "maxKW": 20, "days": 38 },
                    { "maxKW": 100, "days": 38 },
                    { "maxKW": 300, "days": 38 },
                    { "maxKW": 500, "days": 38 },
                    { "maxKW": 999999, "days": 38 }
                ],
                "is_core": true
            }
        ]
    },
    "S": {
        "dept": "採購",
        "code": "S",
        "steps": [
            {
                "id": "S-001",
                "dept": "採購",
                "name": "採購需求彙整",
                "depends_on": [
                    "P-005"
                ],
                "base_offset_days": 20,
                "kw_tiers": [
                    { "maxKW": 20, "days": 20 },
                    { "maxKW": 100, "days": 20 },
                    { "maxKW": 300, "days": 20 },
                    { "maxKW": 500, "days": 20 },
                    { "maxKW": 999999, "days": 20 }
                ],
                "is_core": true
            },
            {
                "id": "S-002",
                "dept": "採購",
                "name": "發包/詢比議價/下單",
                "depends_on": [
                    "B-004",
                    "S-001"
                ],
                "base_offset_days": 22,
                "kw_tiers": [
                    { "maxKW": 20, "days": 22 },
                    { "maxKW": 100, "days": 22 },
                    { "maxKW": 300, "days": 22 },
                    { "maxKW": 500, "days": 22 },
                    { "maxKW": 999999, "days": 22 }
                ],
                "is_core": true
            },
            {
                "id": "S-003",
                "dept": "採購",
                "name": "到貨追蹤/點交驗收",
                "depends_on": [
                    "S-002"
                ],
                "base_offset_days": 28,
                "kw_tiers": [
                    { "maxKW": 20, "days": 28 },
                    { "maxKW": 100, "days": 28 },
                    { "maxKW": 300, "days": 28 },
                    { "maxKW": 500, "days": 28 },
                    { "maxKW": 999999, "days": 28 }
                ],
                "is_core": true
            }
        ]
    },
    "B": {
        "dept": "業務",
        "code": "B",
        "steps": [
            {
                "id": "B-001",
                "dept": "業務",
                "name": "業主需求/範圍確認",
                "depends_on": [
                    "P-002"
                ],
                "base_offset_days": 2,
                "kw_tiers": [
                    { "maxKW": 20, "days": 2 },
                    { "maxKW": 100, "days": 2 },
                    { "maxKW": 300, "days": 2 },
                    { "maxKW": 500, "days": 2 },
                    { "maxKW": 999999, "days": 2 }
                ],
                "is_core": true
            },
            {
                "id": "B-002",
                "dept": "業務",
                "name": "現勘安排與入場協調",
                "depends_on": [
                    "B-001"
                ],
                "base_offset_days": 4,
                "kw_tiers": [
                    { "maxKW": 20, "days": 4 },
                    { "maxKW": 100, "days": 4 },
                    { "maxKW": 300, "days": 4 },
                    { "maxKW": 500, "days": 4 },
                    { "maxKW": 999999, "days": 4 }
                ],
                "is_core": true
            },
            {
                "id": "B-003",
                "dept": "業務",
                "name": "業主確認",
                "depends_on": [
                    "P-004"
                ],
                "base_offset_days": 14,
                "kw_tiers": [
                    { "maxKW": 20, "days": 14 },
                    { "maxKW": 100, "days": 14 },
                    { "maxKW": 300, "days": 14 },
                    { "maxKW": 500, "days": 14 },
                    { "maxKW": 999999, "days": 14 }
                ],
                "is_core": true
            },
            {
                "id": "B-004",
                "dept": "業務",
                "name": "合約/PO/內部簽核完成",
                "depends_on": [
                    "B-003"
                ],
                "base_offset_days": 16,
                "kw_tiers": [
                    { "maxKW": 20, "days": 16 },
                    { "maxKW": 100, "days": 16 },
                    { "maxKW": 300, "days": 16 },
                    { "maxKW": 500, "days": 16 },
                    { "maxKW": 999999, "days": 16 }
                ],
                "is_core": true
            }
        ]
    }
};
