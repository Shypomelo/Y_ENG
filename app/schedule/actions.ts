"use server";

import { revalidatePath } from "next/cache";

import * as scheduleRepo from "../../lib/repositories/schedules";
import * as todoRepo from "../../lib/repositories/todos";
import * as settingsRepo from "../../lib/repositories/settings";
import { DailySchedule, TodoItem } from "../../lib/types/database";

// Schedule Actions
export async function getSchedulesAction(startDate: string, endDate: string) {
    return await scheduleRepo.listSchedules(startDate, endDate);
}

export async function createScheduleAction(schedule: Omit<DailySchedule, 'id' | 'created_at' | 'updated_at'>) {
    if (!schedule.schedule_date || schedule.schedule_date === "") {
        schedule.schedule_date = '1970-01-01';
    }
    const res = await scheduleRepo.createSchedule(schedule);
    revalidatePath('/schedule');
    return res;
}

export async function updateScheduleAction(id: string, updates: Partial<DailySchedule>) {
    try {
        if (!updates.schedule_date || updates.schedule_date === "") {
            updates.schedule_date = '1970-01-01';
        }
        const res = await scheduleRepo.updateSchedule(id, updates);
        revalidatePath('/schedule');
        return res;
    } catch (error: any) {
        console.error("updateScheduleAction Error:", error.message || error);
        throw error;
    }
}

export async function deleteScheduleAction(id: string) {
    try {
        await scheduleRepo.deleteSchedule(id);
        revalidatePath('/schedule');
    } catch (error: any) {
        console.error("deleteScheduleAction Error:", error.message || error);
        throw error;
    }
}

export async function listApplicationsAction() {
    return await scheduleRepo.listApplications();
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
    const data = await settingsRepo.getSetting<T>(id);
    if (!data && id === 'schedule_work_types') {
        return ["掛表", "現勘", "進場", "停電", "建置", "電檢", "驗收", "維修", "清洗", "開會", "內勤", "其他", "休假"] as unknown as T;
    }
    return data;
}
