import { google, calendar_v3 } from 'googleapis';
import { createAdminClient } from './supabase/admin';

// Check if basic credentials exist in environment
export const hasGoogleCredentials = () => {
    return !!process.env.GOOGLE_CLIENT_EMAIL && !!process.env.GOOGLE_PRIVATE_KEY;
};

// Internal helper to get authenticated client and calendar ID
async function getCalendarClient() {
    if (!hasGoogleCredentials()) {
        throw new Error("Missing Google Service Account credentials (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY)");
    }

    const supabase = createAdminClient();
    let calendarId: string | null = null;

    try {
        const { data, error } = await supabase
            .from('google_calendar_settings')
            .select('calendar_id, sync_enabled')
            .single();

        if (error) {
            // PGRST116 means zero rows, other errors might be missing table
            if (error.code !== 'PGRST116') {
                console.warn("[GoogleCalendar] Could not fetch settings. Table might be missing.", error);
                throw new Error("DB_ERROR");
            }
        } else if (data && data.sync_enabled && data.calendar_id) {
            calendarId = data.calendar_id;
        }
    } catch (e: any) {
        if (e.message !== "DB_ERROR") {
            console.warn("[GoogleCalendar] Failed to query settings:", e.message);
        }
        throw new Error("Settings table not migrated or accessible.");
    }

    if (!calendarId) {
        // Fallback to environment variable if DB settings are empty
        calendarId = process.env.GOOGLE_CALENDAR_ID || null;
    }

    if (!calendarId) {
        throw new Error("Calendar sync is disabled (no ID in DB or Env). Please check settings.");
    }

    // Format private key properly if it was passed via env string
    let privateKey = process.env.GOOGLE_PRIVATE_KEY!;
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
    }
    // Handle both escaped \n and actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');

    console.log(`[GoogleCalendar] Attempting auth with ${process.env.GOOGLE_CLIENT_EMAIL?.substring(0, 5)}... and Calendar ID: ${calendarId}`);

    const auth = new google.auth.JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/calendar']
    });

    const calendar = google.calendar({ version: 'v3', auth });
    return { calendar, calendarId };
}

export type ScheduleItemPayload = {
    title: string;
    description?: string;
    location?: string;
    start_datetime: string;
    end_datetime: string;
    is_all_day?: boolean;
};

export async function syncEventToGoogle(scheduleId: string, payload: ScheduleItemPayload, existingGoogleId?: string) {
    try {
        const { calendar, calendarId } = await getCalendarClient();

        const requestBody: calendar_v3.Schema$Event = {
            summary: payload.title,
            description: payload.description || '',
            location: payload.location || '',
        };

        if (payload.is_all_day) {
            requestBody.start = { date: payload.start_datetime.substring(0, 10) };
            const endDate = new Date(payload.end_datetime);
            endDate.setDate(endDate.getDate() + 1);
            requestBody.end = { date: endDate.toISOString().substring(0, 10) };
        } else {
            requestBody.start = { dateTime: payload.start_datetime };
            requestBody.end = { dateTime: payload.end_datetime };
        }

        console.log(`[GoogleCalendar] Syncing ${scheduleId} to ${calendarId}. Payload:`, JSON.stringify(requestBody, null, 2));

        const res = await (existingGoogleId
            ? calendar.events.update({ calendarId, eventId: existingGoogleId, requestBody })
            : calendar.events.insert({ calendarId, requestBody }));

        const syncedId = res.data.id!;
        console.log(`[GoogleCalendar] Sync SUCCESS. Google ID: ${syncedId}`);
        return { success: true, googleEventId: syncedId, calendarId };
    } catch (error: any) {
        console.error("[GoogleCalendar] Sync Failed Detail:", {
            error: error.message,
            code: error.code,
            response: error.response?.data,
            stack: error.stack
        });
        return { success: false, error: error.message, details: error.response?.data };
    }
}

export async function deleteEventFromGoogle(googleEventId: string) {
    try {
        const { calendar, calendarId } = await getCalendarClient();
        await calendar.events.delete({
            calendarId,
            eventId: googleEventId
        });
        return { success: true };
    } catch (error: any) {
        console.error("[GoogleCalendar] Delete Failed:", error.message);
        return { success: false, error: error.message };
    }
}

export async function fetchExternalEvents(timeMin: string, timeMax: string) {
    try {
        const { calendar, calendarId } = await getCalendarClient();
        const res = await calendar.events.list({
            calendarId,
            timeMin: new Date(timeMin).toISOString(),
            timeMax: new Date(timeMax).toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });
        return { success: true, items: res.data.items || [] };
    } catch (error: any) {
        console.warn("[GoogleCalendar] Fetch External Failed:", error.message, error.response?.data);
        return { success: false, error: error.message, details: error.response?.data, items: [] };
    }
}

export async function testGoogleConnection(targetCalendarId?: string) {
    try {
        if (!hasGoogleCredentials()) {
            return { success: false, message: "尚未設定 Google API 憑證 (環境變數遺失)" };
        }
        let privateKey = process.env.GOOGLE_PRIVATE_KEY!;
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = privateKey.slice(1, -1);
        privateKey = privateKey.replace(/\\n/g, '\n');

        const auth = new google.auth.JWT({
            email: process.env.GOOGLE_CLIENT_EMAIL,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/calendar']
        });

        const calendar = google.calendar({ version: 'v3', auth });

        if (targetCalendarId) {
            // Test access and list events to verify
            try {
                const calRes = await calendar.calendars.get({ calendarId: targetCalendarId });
                const eventsRes = await calendar.events.list({
                    calendarId: targetCalendarId,
                    maxResults: 10,
                    timeMin: new Date().toISOString()
                });
                
                const count = eventsRes.data.items?.length || 0;
                if (count > 0) {
                    return { 
                        success: true, 
                        message: `連線成功，已讀取到 ${count} 筆 Google 事件`,
                        details: `日曆：${calRes.data.summary}`
                    };
                } else {
                    return { 
                        success: true, 
                        message: "連線成功，但 Google 日曆目前沒有事件",
                        details: `日曆：${calRes.data.summary}`
                    };
                }
            } catch (err: any) {
                return { 
                    success: false, 
                    message: "連線失敗，目前為優雅降級模式",
                    details: err.message
                };
            }
        }

        return { success: true, message: "Google API 憑證有效。請填寫 Calendar ID 以完成連線。" };

    } catch (error: any) {
        return { success: false, message: `連線失敗: ${error.message}` };
    }
}
