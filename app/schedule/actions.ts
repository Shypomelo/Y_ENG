"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";

import * as scheduleRepo from "../../lib/repositories/schedules";
import * as projectsRepo from "../../lib/repositories/projects";
import * as todoRepo from "../../lib/repositories/todos";
import * as settingsRepo from "../../lib/repositories/settings";
import { DailySchedule, TodoItem } from "../../lib/types/database";
import {
    syncEventToGoogle,
    deleteEventFromGoogle,
    fetchExternalEvents,
    hasGoogleCredentials,
    testGoogleConnection
} from "../../lib/google-calendar";

export type ScheduleCaseSearchItem = {
    id: string;
    project_id?: string | null;
    case_no?: string | null;
    case_name: string;
    address?: string | null;
    region?: string | null;
    site_type?: string | null;
    source: "projects" | "north-sites";
};

const normalizeSearchText = (value: string) =>
    value
        .toLowerCase()
        .normalize("NFKC")
        .replace(/\s+/g, "")
        .trim();

async function readRawCaseSearchItems(): Promise<ScheduleCaseSearchItem[]> {
    const rawPath = path.join(
        process.cwd(),
        "maintenance-probe",
        "probe-output",
        "console",
        "north-sites-master.json"
    );

    try {
        const content = await fs.readFile(rawPath, "utf-8");
        const parsed = JSON.parse(content);
        const rows = Array.isArray(parsed?.data) ? parsed.data : [];

        return rows.map((row: any, index: number) => ({
            id: `north-sites:${row.case_no || index}`,
            case_no: row.case_no || null,
            case_name: row.case_name || "",
            address: row.address || null,
            region: row.region || null,
            site_type: row.site_type || null,
            source: "north-sites"
        })).filter((item: { case_name: string }) => item.case_name);
    } catch (error: any) {
        console.error("readRawCaseSearchItems Error:", error?.message || error);
        return [];
    }
}

export async function listScheduleCaseSearchAction(): Promise<ScheduleCaseSearchItem[]> {
    const [dbProjects, rawSites] = await Promise.all([
        projectsRepo.listProjects(),
        readRawCaseSearchItems()
    ]);

    const merged = new Map<string, ScheduleCaseSearchItem>();

    for (const project of dbProjects) {
        const item: ScheduleCaseSearchItem = {
            id: `project:${project.id}`,
            project_id: project.id,
            case_no: project.case_no || null,
            case_name: project.name || "",
            address: project.address || null,
            source: "projects"
        };

        const key = normalizeSearchText(item.case_no || item.case_name);
        if (item.case_name && !merged.has(key)) {
            merged.set(key, item);
        }
    }

    for (const site of rawSites) {
        const key = normalizeSearchText(site.case_no || site.case_name);
        if (!merged.has(key)) {
            merged.set(key, site);
        }
    }

    return Array.from(merged.values()).sort((a, b) => {
        const nameCompare = a.case_name.localeCompare(b.case_name, "zh-Hant", { numeric: true, sensitivity: "base" });
        if (nameCompare !== 0) return nameCompare;
        return (a.case_no || "").localeCompare(b.case_no || "", "zh-Hant", { numeric: true, sensitivity: "base" });
    });
}

// Schedule Actions
export async function getSchedulesAction(startDate: string, endDate: string) {
    try {
        return await scheduleRepo.listSchedules(startDate, endDate);
    } catch (error: any) {
        console.error("getSchedulesAction Error:", error.message || error);
        throw new Error("讀取排程失敗，請檢查系統環境變數配置。");
    }
}

export async function createScheduleAction(schedule: Omit<DailySchedule, 'id' | 'created_at' | 'updated_at'>) {
    if (!schedule.schedule_date || schedule.schedule_date === "") {
        schedule.schedule_date = '1970-01-01';
    }

    // Ensure mandatory field case_name is never null or undefined
    if (!schedule.case_name) {
        console.warn("[ScheduleActions] createScheduleAction received null/empty case_name. Providing fallback.");
        schedule.case_name = '從 Google 匯入 (未命名)';
    }
    
    // Ensure status is never null for internal adoption
    if (!schedule.status) {
        schedule.status = 'pending_claim';
    }

    // 1. Create in Database
    const res = await scheduleRepo.createSchedule(schedule) as any;

    // 2. Sync to Google Calendar if configured
    if (res && res.id && hasGoogleCredentials() && schedule.source !== 'google_readonly') {
        const startTimeStr = schedule.start_time || '00:00:00';
        const endTimeStr = schedule.end_time || '23:59:59';

        const payload = {
            title: schedule.title || schedule.case_name || '未命名排程',
            description: schedule.description || '',
            location: schedule.address || '',
            start_datetime: schedule.start_datetime || `${schedule.schedule_date}T${startTimeStr.substring(0, 5)}:00+08:00`,
            end_datetime: schedule.end_datetime || `${schedule.schedule_date}T${endTimeStr.substring(0, 5)}:00+08:00`,
            is_all_day: schedule.is_all_day || false
        };
        const syncRes = await syncEventToGoogle(res.id, payload, schedule.google_event_id || undefined);
        console.log(`[ScheduleActions] Create sync for ID ${res.id} result:`, syncRes.success ? "✅ Success" : "❌ Failed", syncRes.googleEventId || "");
        
        if (syncRes.success && syncRes.googleEventId) {
            await scheduleRepo.updateSchedule(res.id, {
                google_event_id: syncRes.googleEventId,
                google_calendar_id: syncRes.calendarId,
                sync_status: 'synced',
                last_synced_at: new Date().toISOString()
            });
            res.google_event_id = syncRes.googleEventId;
            res.sync_status = 'synced';
            res.last_synced_at = new Date().toISOString();
        } else if (!syncRes.success) {
            console.error(`[ScheduleActions] Create sync failed for ${res.id}:`, (syncRes as any).error);
            await scheduleRepo.updateSchedule(res.id, { 
                sync_status: 'failed',
                last_synced_at: new Date().toISOString() 
            });
            res.sync_status = 'failed';
        }
        res.googleSync = { success: syncRes.success, error: (syncRes as any).error };
    }

    revalidatePath('/schedule');
    return res;
}

export async function updateScheduleAction(id: string, updates: Partial<DailySchedule>) {
    try {
        const isVirtualGoogle = id.startsWith('google-');
        const googleEventId = isVirtualGoogle ? id.replace('google-', '') : null;

        if (updates.schedule_date === "") {
            updates.schedule_date = '1970-01-01';
        }

        // Get existing to find internal mapping or the record itself
        const existing = await scheduleRepo.listSchedules('1970-01-01', '2100-01-01');
        
        let targetId = id;
        let currentMapping = existing.find(s => s.id === id);

        // If it's a virtual ID, we try to find its corresponding internal record
        if (isVirtualGoogle && googleEventId) {
            currentMapping = existing.find(s => s.google_event_id === googleEventId);
            if (currentMapping) {
                targetId = currentMapping.id;
            } else {
                // Not in DB yet? This is an ADOPTION.
                console.log(`[ScheduleActions] Adopting virtual/Google event: ${googleEventId}`, updates);
                
                // Ensure we have mandatory fields or fallbacks
                const newSchedule = {
                    ...updates,
                    google_event_id: googleEventId,
                    case_name: updates.case_name || (updates as any).title || '從 Google 匯入 (未命名)',
                    source: 'internal',
                    sync_status: 'synced',
                    status: updates.status || 'pending_claim'
                } as any;
                
                const created = await createScheduleAction(newSchedule);
                console.log(`[ScheduleActions] Adoption complete for: ${googleEventId} -> Internal ID: ${created.id}`);
                revalidatePath('/schedule');
                return created;
            }
        }

        const res = await scheduleRepo.updateSchedule(targetId, updates) as any;

        // Sync to Google Calendar if configured
        if (currentMapping && hasGoogleCredentials()) {
            const startTimeStr = updates.start_time ?? currentMapping.start_time ?? '00:00:00';
            const endTimeStr = updates.end_time ?? currentMapping.end_time ?? '23:59:59';
            const dateStr = updates.schedule_date || currentMapping.schedule_date;

            const payload = {
                title: updates.case_name || currentMapping.case_name || '未命名排程',
                description: updates.description ?? currentMapping.description ?? '',
                location: updates.address ?? currentMapping.address ?? '',
                start_datetime: `${dateStr}T${startTimeStr.substring(0, 5)}:00+08:00`,
                end_datetime: `${dateStr}T${endTimeStr.substring(0, 5)}:00+08:00`,
                is_all_day: updates.is_all_day ?? currentMapping.is_all_day ?? false
            };
            
            const syncRes = await syncEventToGoogle(targetId, payload, currentMapping.google_event_id || undefined);
            console.log(`[ScheduleActions] Update sync for ID ${targetId} result:`, syncRes.success ? "✅ Success" : "❌ Failed");
            
            if (syncRes.success && syncRes.googleEventId) {
                await scheduleRepo.updateSchedule(targetId, {
                    google_event_id: syncRes.googleEventId,
                    sync_status: 'synced',
                    last_synced_at: new Date().toISOString()
                });
                res.google_event_id = syncRes.googleEventId;
                res.sync_status = 'synced';
            }
            res.googleSync = { success: syncRes.success, error: (syncRes as any).error };
        }

        revalidatePath('/schedule');
        return res;
    } catch (error: any) {
        console.error("updateScheduleAction Error:", error.message || error);
        throw error;
    }
}

export async function deleteScheduleAction(id: string) {
    try {
        const isVirtualGoogle = id.startsWith('google-');
        const googleEventId = isVirtualGoogle ? id.replace('google-', '') : null;

        // Get existing to find internal mapping or the record itself
        const existing = await scheduleRepo.listSchedules('1970-01-01', '2100-01-01');
        
        let targetId = id;
        let mapping = existing.find(s => s.id === id);

        // If it's a virtual ID, we try to find its corresponding internal record
        if (isVirtualGoogle && googleEventId) {
            mapping = existing.find(s => s.google_event_id === googleEventId);
            if (mapping) {
                targetId = mapping.id;
            }
        }

        // Only delete from DB if it's NOT a pure virtual overlay that hasn't been mapped yet
        if (!isVirtualGoogle || mapping) {
            await scheduleRepo.deleteSchedule(targetId);
        }

        let googleDeleted = true;
        let deleteError = null;

        // Determine which Google ID to delete
        const finalGoogleId = googleEventId || mapping?.google_event_id;

        if (finalGoogleId && hasGoogleCredentials()) {
            const syncRes = await deleteEventFromGoogle(finalGoogleId);
            console.log(`[ScheduleActions] Delete sync for Google ID ${finalGoogleId} result:`, syncRes.success ? "✅ Success" : "❌ Failed");
            if (!syncRes.success) {
                googleDeleted = false;
                deleteError = syncRes.error;
            }
        }

        revalidatePath('/schedule');
        return { success: true, googleSync: { success: googleDeleted, error: deleteError } };
    } catch (error: any) {
        console.error("deleteScheduleAction Error:", error.message || error);
        throw error;
    }
}

const normalizeGoogleOverlayTime = (value?: string | null) => {
    if (!value) return null;
    return `${value.slice(0, 5)}:00`;
};

const hasGoogleOverlayTimingDrift = (internal: DailySchedule, overlay: DailySchedule) => {
    return (
        (internal.schedule_date || null) !== (overlay.schedule_date || null) ||
        (internal.start_time || null) !== normalizeGoogleOverlayTime(overlay.start_time) ||
        (internal.end_time || null) !== normalizeGoogleOverlayTime(overlay.end_time) ||
        Boolean(internal.is_all_day) !== Boolean(overlay.is_all_day)
    );
};

const buildGoogleOverlayTimingUpdates = (overlay: DailySchedule): Partial<DailySchedule> => ({
    schedule_date: overlay.schedule_date || '1970-01-01',
    start_time: overlay.is_all_day ? null : normalizeGoogleOverlayTime(overlay.start_time),
    end_time: overlay.is_all_day ? null : normalizeGoogleOverlayTime(overlay.end_time),
    start_datetime: overlay.start_datetime || null,
    end_datetime: overlay.end_datetime || null,
    is_all_day: overlay.is_all_day ?? false,
    sync_status: 'synced',
    last_synced_at: new Date().toISOString()
});

export async function fetchGoogleOverlayAction(timeMin: string, timeMax: string) {
    if (!hasGoogleCredentials()) return [];
    const res = await fetchExternalEvents(timeMin, timeMax);
    if (!res.success) return [];

    // Map Google Event format to matching DailySchedule UI overlay format
    return res.items.map((item: any) => {
        let dateStr = item.start?.date || item.start?.dateTime?.substring(0, 10);
        let startTimeVal = item.start?.dateTime ? item.start.dateTime.substring(11, 16) : null;
        let endTimeVal = item.end?.dateTime ? item.end.dateTime.substring(11, 16) : null;

        return {
            id: `google-${item.id}`,
            case_name: item.summary || 'Google 行事曆事件',
            title: item.summary || 'Google 行事曆事件',
            description: item.description,
            address: item.location,
            schedule_date: dateStr,
            start_time: startTimeVal,
            end_time: endTimeVal,
            start_datetime: item.start?.dateTime || item.start?.date,
            end_datetime: item.end?.dateTime || item.end?.date,
            is_all_day: !!item.start?.date,
            source: 'google_readonly',
            google_event_id: item.id,
        } as unknown as DailySchedule;
    });
}

export async function getScheduleViewDataAction(startDate: string, endDate: string, timeMin: string, timeMax: string) {
    const [internalData, googleOverlay] = await Promise.all([
        scheduleRepo.listSchedules(startDate, endDate),
        fetchGoogleOverlayAction(timeMin, timeMax).catch((error) => {
            console.error("getScheduleViewDataAction Google overlay failed:", error?.message || error);
            return [];
        })
    ]);

    if (!googleOverlay.length) {
        return internalData;
    }

    const allInternalSchedules = await scheduleRepo.listSchedules('1970-01-01', '2100-01-01');
    const internalByGoogleId = new Map(
        allInternalSchedules
            .filter((item) => item.source !== 'google_readonly' && item.google_event_id)
            .map((item) => [item.google_event_id!, item] as const)
    );

    const updateTargets = googleOverlay
        .map((overlay) => {
            const googleEventId = overlay.google_event_id;
            const existingInternal = googleEventId ? internalByGoogleId.get(googleEventId) : null;
            if (!existingInternal) {
                return null;
            }

            if (!hasGoogleOverlayTimingDrift(existingInternal, overlay)) {
                return null;
            }

            return {
                id: existingInternal.id,
                updates: buildGoogleOverlayTimingUpdates(overlay)
            };
        })
        .filter((item): item is { id: string; updates: Partial<DailySchedule> } => Boolean(item));

    if (updateTargets.length > 0) {
        await Promise.all(
            updateTargets.map((item) => scheduleRepo.updateSchedule(item.id, item.updates))
        );
        revalidatePath('/schedule');
    }

    const refreshedInternalData = updateTargets.length > 0
        ? await scheduleRepo.listSchedules(startDate, endDate)
        : internalData;

    const mappedGoogleEventIds = new Set(internalByGoogleId.keys());
    const unmatchedGoogleOverlay = googleOverlay.filter(
        (item) => !item.google_event_id || !mappedGoogleEventIds.has(item.google_event_id)
    );

    return [...refreshedInternalData, ...unmatchedGoogleOverlay];
}

export async function testGoogleSyncAction() {
    // 1. Check basic Env Vars
    if (!hasGoogleCredentials()) {
        return { success: false, message: "尚未配置 Google API 環境變數 (CLIENT_EMAIL 或 PRIVATE_KEY)" };
    }

    // 2. Use GOOGLE_CALENDAR_ID from Env
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "";
    if (!calendarId) {
        return { success: false, message: "尚未配置 GOOGLE_CALENDAR_ID 環境變數" };
    }

    // 3. Test actual connection
    const res = await testGoogleConnection(calendarId);
    return res;
}

export async function listApplicationsAction() {
    try {
        return await scheduleRepo.listApplications();
    } catch (error: any) {
        console.error("listApplicationsAction Error:", error.message || error);
        throw new Error("讀取任務申請失敗，請檢查系統環境變數配置。");
    }
}

// Todo Actions
export async function listTodosAction() {
    return await todoRepo.listTodos();
}

export async function createTodoAction(title: string) {
    const res = await todoRepo.createTodo(title);
    revalidatePath('/schedule');
    return res;
}

export async function updateTodoAction(id: string, updates: Partial<TodoItem>) {
    const res = await todoRepo.updateTodo(id, updates);
    revalidatePath('/schedule');
    return res;
}

export async function deleteTodoAction(id: string) {
    await todoRepo.deleteTodo(id);
    revalidatePath('/schedule');
}

// Settings Actions
export async function getSettingAction<T>(id: string) {
    try {
        const data = await settingsRepo.getSetting<T>(id);
        if (!data && id === 'schedule_work_types') {
            return ["掛表", "現勘", "進場", "停電", "建置", "電檢", "驗收", "維修", "清洗", "開會", "內勤", "其他", "休假"] as unknown as T;
        }
        return data;
    } catch (error: any) {
        console.error("getSettingAction Error:", error.message || error);
        // Fallback for critical settings
        if (id === 'schedule_work_types') {
            return ["掛表", "現勘", "進場", "停電", "建置", "電檢", "驗收", "維修", "清洗", "開會", "內勤", "其他", "休假"] as unknown as T;
        }
        return null;
    }
}
