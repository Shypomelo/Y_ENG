export const PROJECT_STATUS_OPTIONS = ["未開始", "進行中", "完成", "卡關", "已結案"] as const;

export const STATUS_STYLES: Record<string, string> = {
    "未開始": "bg-zinc-100 text-zinc-700",
    "進行中": "bg-blue-100 text-blue-700",
    "完成": "bg-emerald-100 text-emerald-700",
    "卡關": "bg-red-100 text-red-700",
    "已結案": "bg-purple-100 text-purple-700"
};
