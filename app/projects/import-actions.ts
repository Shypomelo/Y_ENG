"use server";

import * as staffRepo from "../../lib/repositories/staff";
import * as vendorRepo from "../../lib/repositories/vendors";
import * as projectsRepo from "../../lib/repositories/projects";

export async function fetchLookupDataAction() {
    const [staff, vendors, existingProjects] = await Promise.all([
        staffRepo.listStaffByDepartment(),
        vendorRepo.listVendorsByCategory(),
        projectsRepo.listProjects(),
    ]);

    return {
        staff: staff.map(s => ({ id: s.id, name: s.name, department: s.department })),
        vendors: vendors.map(v => ({ id: v.id, name: v.name, category: v.category })),
        existingProjectNames: existingProjects.map(p => p.name),
    };
}
