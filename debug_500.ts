import { createAdminClient } from "./lib/supabase/admin";
import * as inventoryRepo from "./lib/repositories/inventory";

async function debug() {
    const month = "2026-03";
    console.log("--- Debugging Inventory Actions ---");
    
    try {
        console.log("Checking getInventoryItems...");
        const items = await inventoryRepo.getInventoryItems();
        console.log("Items found:", items.length);
    } catch (e) {
        console.error("getInventoryItems failed:", e);
    }

    try {
        console.log("Checking getInventorySummary...");
        const summary = await inventoryRepo.getInventorySummary(month);
        console.log("Summary items:", summary.length);
    } catch (e) {
        console.error("getInventorySummary failed:", e);
    }

    try {
        console.log("Checking getMonthlyUsageLogs...");
        const logs = await inventoryRepo.getMonthlyUsageLogs(month);
        console.log("Usage logs:", logs.length);
    } catch (e) {
        console.error("getMonthlyUsageLogs failed:", e);
    }

    try {
        const supabase = createAdminClient();
        console.log("Checking maintenance_reports table...");
        const { data, error } = await supabase.from('maintenance_reports').select('*').limit(1);
        if (error) console.error("maintenance_reports error:", error);
        else console.log("maintenance_reports ok");
    } catch (e) {
        console.error("maintenance_reports query failed:", e);
    }
}

debug();
