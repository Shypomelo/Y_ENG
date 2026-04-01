"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as staffRepo from "../../lib/repositories/staff";
import * as vendorRepo from "../../lib/repositories/vendors";
import * as projectsRepo from "../../lib/repositories/projects";
import * as flowsRepo from "../../lib/repositories/flows";
import { createAdminClient } from "../../lib/supabase/admin";
import { revalidatePath } from "next/cache";

function normalizeName(name: string | null | undefined): string {
    if (!name) return "";
    let n = name
        .normalize("NFKC") // 轉半形、統一編碼
        .replace(/\s+/g, "") // 移除所有空白
        .toLowerCase();
    
    // 特殊別名處理 (同一人但不同寫法)
    if (n === "柚子") n = "子佑";
    
    return n;
}

export async function fetchLookupDataAction() {
    const [staff, vendors, existingProjects, flowConfig] = await Promise.all([
        staffRepo.listStaffByDepartment(),
        vendorRepo.listVendorsByCategory(),
        projectsRepo.listProjects(),
        flowsRepo.fetchAllFlowConfig(),
    ]);

    // Unique step names
    const uniqueStepNames = Array.from(new Set(flowConfig.steps.map(s => s.step_name))).sort();

    return {
        staff: staff.map(s => ({ id: s.id, name: s.name, department: s.department })),
        vendors: vendors.map(v => ({ id: v.id, name: v.name, category: v.category })),
        existingProjects: existingProjects.map(p => ({ 
            id: p.id, 
            name: p.name, 
            case_no: p.case_no, 
            address: p.address,
            owners: p.owners
        })),
        existingProjectNames: existingProjects.map(p => p.name),
        allStepNames: uniqueStepNames,
    };
}

export async function performImportAction(payload: {
    projects: any[];
    steps: any[];
}) {
    const supabase = createAdminClient();
    const results = {
        projectsCreated: 0,
        stepsCreated: 0,
        errors: [] as string[],
    };

    try {
        // 1. Fetch lookup data for deduplication and templates
        const [lookup, { steps: allTmplSteps }] = await Promise.all([
            fetchLookupDataAction(),
            flowsRepo.fetchAllFlowConfig()
        ]);

        for (const p of payload.projects) {
            try {
                const { rowIndex, ...dbPayload } = p;
                
                // --- 2. Deduplication Logic ---
                let existingProjectId: string | null = null;
                let existingProject: any = null;

                // Priority 1: Case No
                if (dbPayload.case_no) {
                    existingProject = lookup.existingProjects.find(ep => ep.case_no === dbPayload.case_no);
                }

                // Priority 2: Case Name (Normalized)
                if (!existingProject && dbPayload.name) {
                    const normNew = normalizeName(dbPayload.name);
                    existingProject = lookup.existingProjects.find(ep => normalizeName(ep.name) === normNew);
                }

                if (existingProject) {
                    existingProjectId = existingProject.id;
                    console.log(`[Import] Found existing project (row ${rowIndex}): ${existingProject.name} (ID: ${existingProjectId})`);
                    
                    // --- 3. Address History Handling ---
                    const newAddress = dbPayload.address;
                    const oldAddress = existingProject.address;
                    if (newAddress && oldAddress && normalizeName(newAddress) !== normalizeName(oldAddress)) {
                        const currentOwners = (existingProject.owners as Record<string, any>) || {};
                        const history = (currentOwners.address_history as string[]) || [];
                        if (!history.includes(oldAddress)) {
                            history.push(oldAddress);
                        }
                        dbPayload.owners = {
                            ...(dbPayload.owners || {}),
                            ...currentOwners,
                            address_history: history
                        };
                        console.log(`[Import] Address changed for ${dbPayload.name}. Old address archived.`);
                    } else if (existingProject.owners) {
                        // Merge existing owners if no address change to preserve history
                        dbPayload.owners = {
                            ...(dbPayload.owners || {}),
                            ...(existingProject.owners as any)
                        };
                    }

                    // UPDATE Project
                    const { error: uError } = await supabase
                        .from('projects')
                        .update(dbPayload)
                        .eq('id', existingProjectId as string);

                    if (uError) throw new Error(`案件 "${p.name}" 更新失敗: ${uError.message}`);
                } else {
                    // INSERT Project
                    console.log(`[Import] Inserting NEW project (row ${rowIndex}):`, dbPayload.name);
                    const { data: newP, error: iError } = await supabase
                        .from('projects')
                        .insert(dbPayload)
                        .select()
                        .single();

                    if (iError) throw new Error(`案件 "${p.name}" 新增失敗: ${iError.message}`);
                    existingProjectId = newP.id;
                    results.projectsCreated++;
                }

                // --- 4. Steps Upsert Logic ---
                if (existingProjectId) {
                    // Fetch existing steps for this project to decide update vs insert
                    const { data: existingSteps } = await supabase
                        .from('project_steps')
                        .select('id, template_step_key, step_name')
                        .eq('project_id', existingProjectId as string);

                    const projectStepsPayload = payload.steps
                        .filter(s => s.rowIndex === p.rowIndex)
                        .map(s => {
                            const tmplStep = allTmplSteps?.find(ts => ts.step_name === s.step_name);
                            const stepKey = tmplStep ? tmplStep.step_key : s.template_step_key;
                            
                            // Check if this step already exists
                            const existingS = existingSteps?.find(es => es.template_step_key === stepKey || es.step_name === s.step_name);

                            return {
                                id: existingS?.id, // If ID exists, it will be used for upsert if we used .upsert(), but we'll do manual for clarity
                                project_id: existingProjectId,
                                template_step_key: stepKey,
                                step_name: s.step_name,
                                owner_role: tmplStep ? tmplStep.owner_role : null,
                                baseline_date: s.baseline_date,
                                current_planned_date: s.current_planned_date,
                                actual_date: s.actual_date,
                                status: s.actual_date ? "完成" : (existingS as any)?.status || "未開始",
                                sort_order: tmplStep?.sort_order || s.sort_order || 99,
                            };
                        });

                    for (const stepObj of projectStepsPayload) {
                        const { id, ...stepData } = stepObj;
                        if (id) {
                            // Update existing step
                            await supabase.from('project_steps').update(stepData).eq('id', id);
                        } else {
                            // Insert new step
                            await supabase.from('project_steps').insert(stepData);
                            results.stepsCreated++;
                        }
                    }
                }
            } catch (innerErr: any) {
                results.errors.push(innerErr.message);
            }
        }
    } catch (err: any) {
        results.errors.push(`整體匯入錯誤: ${err.message}`);
    }

    revalidatePath("/projects");
    return results;
}

export async function repairProjectsDataAction() {
    const supabase = createAdminClient();
    const results = {
        staffMatchesUpdated: 0,
        unmatchedNames: [] as string[],
        stepsReordered: 0,
        statusUpdated: 0,
        errors: [] as string[]
    };

    try {
        // 1. Fetch Staff
        const staffList = await staffRepo.listStaffByDepartment();
        const findStaffId = (name: string | null) => {
            if (!name) return null;
            const normName = normalizeName(name);
            const match = staffList.find(s => normalizeName(s.name) === normName);
            if (!match) results.unmatchedNames.push(name);
            return match ? match.id : null;
        };

        // 2. Fetch Templates
        const { steps: allTmplSteps } = await flowsRepo.fetchAllFlowConfig();

        // 3. Fetch All Projects & Steps
        const { data: projects, error: pErr } = await supabase.from('projects').select('*');
        if (pErr) throw pErr;

        const { data: steps, error: sErr } = await supabase.from('project_steps').select('*');
        if (sErr) throw sErr;

        for (const proj of projects) {
            let pUpdates: any = {};
            
            // A. STAFF REMAPPING FROM OWNERS JSON
            if (proj.owners && typeof proj.owners === 'object') {
                const o = proj.owners as Record<string, unknown>;
                
                // 嚴格對應規則
                // 工程/工務 -> engineer_id
                // 專案/PM -> project_manager_id
                const engName = (o.工程 || o.工務 || o.engineering || o.engineer) as string | null;
                const pmName = (o.專案 || o.PM || o.pm) as string | null;
                const salesName = (o.業務 || o.sales) as string | null;
                const structureName = (o.結構 || o.structural || o.structure) as string | null;
                const adminName = (o.行政 || o.admin) as string | null;

                const mappedEngId = findStaffId(engName);
                const mappedPmId = findStaffId(pmName);
                const mappedSalesId = findStaffId(salesName);
                const mappedStructureId = findStaffId(structureName);
                const mappedAdminId = findStaffId(adminName);

                if (mappedEngId && proj.engineer_id !== mappedEngId) pUpdates.engineer_id = mappedEngId;
                if (mappedPmId && proj.project_manager_id !== mappedPmId) pUpdates.project_manager_id = mappedPmId;
                if (mappedSalesId && proj.sales_id !== mappedSalesId) pUpdates.sales_id = mappedSalesId;
                if (mappedStructureId && proj.structure_id !== mappedStructureId) pUpdates.structure_id = mappedStructureId;
                if (mappedAdminId && proj.admin_id !== mappedAdminId) pUpdates.admin_id = mappedAdminId;
            }

            // B. Re-calc Status & Standardize Lanes & BACKFILL STEPS
            let pSteps = (steps || []).filter((s: any) => s.project_id === proj.id);

            // --- NEW: Backfill missing steps if empty ---
            if (pSteps.length === 0 && allTmplSteps && allTmplSteps.length > 0) {
                console.log(`[Repair] Backfilling steps for project: ${proj.name}`);
                const backfillPayload = allTmplSteps.map(ts => ({
                    project_id: proj.id,
                    template_step_key: ts.step_key,
                    step_name: ts.step_name,
                    owner_role: ts.owner_role,
                    baseline_date: proj.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                    current_planned_date: proj.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                    status: "未開始",
                    sort_order: ts.sort_order,
                }));
                const { data: newSteps, error: bfError } = await supabase
                    .from('project_steps')
                    .insert(backfillPayload)
                    .select();
                
                if (!bfError && newSteps) {
                    pSteps = newSteps;
                    results.stepsReordered += newSteps.length;
                }
            }
            
            // Standardize Step Lanes (Stored as owner_role in DB)
            if (pSteps.length > 0) {
                for (const s of pSteps) {
                    let sUpdates: any = {};
                    let newRole = s.owner_role;
                    if (s.owner_role === "工務" || s.owner_role === "工程人員") newRole = "工程";
                    if (s.owner_role === "PM" || s.owner_role === "專案人員") newRole = "專案";

                    if (newRole !== s.owner_role) {
                        sUpdates.owner_role = newRole;
                    }

                    if (Object.keys(sUpdates).length > 0) {
                        await supabase.from('project_steps').update(sUpdates).eq('id', s.id);
                    }
                }
            }

            // --- NEW: Sync back names to owners JSON for legacy UI compatibility ---
            if (pUpdates.engineer_id || pUpdates.project_manager_id || pUpdates.sales_id || pUpdates.structure_id || pUpdates.admin_id) {
                const currentOwners = (proj.owners as Record<string, any>) || {};
                const syncOwners = { ...currentOwners };
                
                if (pUpdates.engineer_id) syncOwners.engineering = staffList.find(s => s.id === pUpdates.engineer_id)?.name || syncOwners.engineering;
                
                // 預設值與別名處理：若無工程人員或為「未指定」，則預設為「柚子」；若是「子佑」也統一為「柚子」
                if (!syncOwners.engineering || syncOwners.engineering === "未指定" || syncOwners.engineering === "子佑") {
                    syncOwners.engineering = "柚子";
                }

                if (pUpdates.project_manager_id) syncOwners.pm = staffList.find(s => s.id === pUpdates.project_manager_id)?.name || syncOwners.pm;
                if (pUpdates.sales_id) syncOwners.sales = staffList.find(s => s.id === pUpdates.sales_id)?.name || syncOwners.sales;
                if (pUpdates.structure_id) syncOwners.structural = staffList.find(s => s.id === pUpdates.structure_id)?.name || syncOwners.structural;
                if (pUpdates.admin_id) syncOwners.admin = staffList.find(s => s.id === pUpdates.admin_id)?.name || syncOwners.admin;
                
                pUpdates.owners = syncOwners;
            }

            const isClosed = pSteps.some((s: any) => s.step_name.includes("結案") && s.actual_date) || proj.is_closed;
            const isMetered = pSteps.some((s: any) => s.step_name.includes("掛表") && s.actual_date);
            
            let targetStatus = "進行中";
            if (isClosed) targetStatus = "已結案";
            else if (isMetered) targetStatus = "已掛表";
            
            if (proj.status_flag !== targetStatus) {
                pUpdates.status_flag = targetStatus;
                results.statusUpdated++;
            }

            if (Object.keys(pUpdates).length > 0) {
                const { error: updErr } = await supabase.from('projects').update(pUpdates).eq('id', proj.id);
                if (updErr) {
                    results.errors.push(`Project ${proj.name} update failed: ${updErr.message}`);
                } else {
                    if (pUpdates.engineer_id || pUpdates.project_manager_id || pUpdates.sales_id || pUpdates.structure_id || pUpdates.admin_id) {
                        results.staffMatchesUpdated++;
                    }
                }
            }

            // C. STEP REORDERING (already backfilled if empty, now just double check existing)
            if (pSteps.length > 0) {
                for (const step of pSteps) {
                    const tmpl = allTmplSteps?.find(ts => ts.step_name === step.step_name);
                    if (tmpl && tmpl.sort_order && step.sort_order !== tmpl.sort_order) {
                        const { error: stepUpdErr } = await supabase
                            .from('project_steps')
                            .update({ sort_order: tmpl.sort_order })
                            .eq('id', step.id);
                            
                        if (!stepUpdErr) {
                            results.stepsReordered++;
                        }
                    }
                }
            }
        }

        // Deduplicate unmatched names
        results.unmatchedNames = Array.from(new Set(results.unmatchedNames));

    } catch (e: any) {
        results.errors.push(e.message);
    }

    revalidatePath("/projects");
    return results;
}
