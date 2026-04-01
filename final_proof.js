const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// 1. Load Env
try {
    const envPath = path.join(process.cwd(), '.env.local');
    const env = fs.readFileSync(envPath, 'utf8');
    env.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const k = parts[0].trim();
            const v = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
            process.env[k] = v;
        }
    });

    if (!process.env.GOOGLE_PRIVATE_KEY) throw new Error("GOOGLE_PRIVATE_KEY is missing in env");
    if (!process.env.GOOGLE_CLIENT_EMAIL) throw new Error("GOOGLE_CLIENT_EMAIL is missing in env");
    if (!process.env.GOOGLE_CALENDAR_ID) throw new Error("GOOGLE_CALENDAR_ID is missing in env");

    async function runTest() {
        console.log("--- Google Calendar Sync 實測證據獲取程序 ---");

        // A. Supabase 準備
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const testTitle = `Antigravity 驗證測試 - ${new Date().toLocaleTimeString('zh-TW')}`;
        const scheduleData = {
            case_name: testTitle,
            schedule_date: "2026-03-31",
            start_time: "14:00:00",
            end_time: "15:00:00",
            status: "scheduled",
            case_type: "進場",
            description: "這是 Antigravity 執行的全鏈路同步測試，用於提供實測證據。"
        };

        console.log("1. 正在寫入內部資料庫...");
        const { data: dbRes, error: dbErr } = await supabase.from('daily_schedules').insert(scheduleData).select().single();
        if (dbErr) { console.error("   [錯誤] 資料庫寫入失敗:", dbErr.message); return; }

        const internalId = dbRes.id;
        console.log("   >>> Internal Schedule ID:", internalId);

        // B. Google 同步準備
        let privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
        const auth = new google.auth.JWT({
            email: process.env.GOOGLE_CLIENT_EMAIL,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/calendar']
        });
        const calendar = google.calendar({ version: 'v3', auth });

        console.log("2. 正在執行 Google Calendar 同步 (Insert)...");
        try {
            const startTimeIso = `2026-03-31T14:00:00+08:00`;
            const endTimeIso = `2026-03-31T15:00:00+08:00`;

            const gRes = await calendar.events.insert({
                calendarId: process.env.GOOGLE_CALENDAR_ID,
                requestBody: {
                    summary: testTitle,
                    description: scheduleData.description,
                    start: { dateTime: startTimeIso },
                    end: { dateTime: endTimeIso },
                }
            });

            const googleEventId = gRes.data.id;
            console.log("   >>> Google Event ID:", googleEventId);

            // C. 寫回資料庫狀態
            console.log("3. 正在更新資料庫同步狀態...");
            const lastSyncedAt = new Date().toISOString();
            const { data: finalRes, error: upErr } = await supabase.from('daily_schedules').update({
                google_event_id: googleEventId,
                sync_status: 'synced',
                last_synced_at: lastSyncedAt
            }).eq('id', internalId).select().single();

            if (upErr) { console.error("   [錯誤] 資料庫狀態更新失敗:", upErr.message); return; }

            console.log("\n=== 實測報告結果 ===");
            console.log(`[1] 內部排程 ID (Internal ID): ${internalId}`);
            console.log(`[2] Google 事件 ID (Google ID): ${googleEventId}`);
            console.log(`[3] 資料庫同步狀態 (DB sync_status): ${finalRes.sync_status}`);
            console.log(`[4] 最後同步時間 (last_synced_at): ${finalRes.last_synced_at}`);
            console.log(`[5] 日曆核對資訊:`);
            console.log(`    - 標題: ${testTitle}`);
            console.log(`    - 日期: 2026-03-31`);
            console.log(`    - 時間: 14:00 - 15:00 (台北時區)`);
            console.log("====================\n");

        } catch (gErr) {
            console.error("   [失敗] Google 同步發生錯誤!");
            console.error("   Message:", gErr.message);
            if (gErr.response) {
                console.error("   API Error Details:", JSON.stringify(gErr.response.data, null, 2));
            }
        }
    }

    runTest();
} catch (err) {
    console.error("腳本啟動失敗:", err.message);
}
