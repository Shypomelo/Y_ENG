# Mapping Check Report (Evidence-Based)

## A. File Evidence
| File Type | Source | Actual Rows | Path |
| :--- | :--- | :--- | :--- |
| **Projects** | sg_pjm.html (CRUD) | 166 | [project-records.normalized.json](file:///d:/工程系統/maintenance-probe/probe-output/console/project-records.normalized.json) |
| **All Reports** | sg_ops.html (CRUD) | 28 | [maintenance-reports.normalized.json](file:///d:/工程系統/maintenance-probe/probe-output/console/maintenance-reports.normalized.json) |
| **North Reports** | Historical filtered north subset (not current full baseline) | 5 | [north-reports.normalized.json](file:///d:/工程系統/maintenance-probe/probe-output/console/north-reports.normalized.json) |

## B. Field Completeness Analysis
- **Project Records**: Contains 17 fields including `case_no`, `case_name`, `address`, `pm`, etc.
- **Maintenance Reports**: Contains 14 fields, but Columns 0, 1, and 2 are **merged** (containing newlines).
  - Column 0: `Region\nCaseName\nCaseNo`
  - Column 1: `ReportTime\nReporter\nIssue`
- **Missing Fields**: 
  - ❌ `site_contact_name`: Not found in any extracted file.
  - ❌ `site_contact_phone`: Not found in any extracted file.
  - ⚠️ `customer_email`: Only exists in Project Records.

## C. Mapping Statistics
| Category | Stats | Note |
| :--- | :--- | :--- |
| **Total Reports Checked** | 28 | Base dataset |
| **Successful Matches** | 1 (3.57%) | Only "測試勿動" matched correctly |
| **Partial Name Matches** | ~4 | e.g. "天泰智慧" prefix exists but full name differs |
| **Unmatched** | 27 | 96.43% of reports refer to non-existent projects |

> [!IMPORTANT]
> **Why is the success rate low?**
> Many of the 28 O&M reports refer to older or specific projects (e.g., `23SR132`, `22SR187`) that are **not** present in the current 166-item Project Management list (`B2026...`, `A2025...`). These likely belong to a "Completed" or "Legacy" archive not visible in the `sg_pjm.html` default view.

## D. Evidence Samples
### 1. Success Sample (Direct Match)
| Source | Case No | Case Name | By |
| :--- | :--- | :--- | :--- |
| **Report** | `D2486001` | 測試勿動-維運 | |
| **Project** | `C2486001` | 測試勿動 | **Normalized ID (Numeric)** |

### 2. Failure Samples (Data Gap)
| Report Name | Report ID | Analysis |
| :--- | :--- | :--- |
| 天泰智慧-鑫圓工程 | 23SR132 | **Unmatched**. PJM list only has "天泰智慧-郭志鵬" / "天泰智慧-張毅侖". |
| 明澤興業-川其開發 | 23SR101 | **Unmatched**. PJM list does not contain "川其開發". |
| 林梅雪 | 19S095 | **Unmatched**. Historical project not in active 166 list. |

## E. Maintenance Card Model Proposal
| Field Name | Source Column | Strategy |
| :--- | :--- | :--- |
| **case_no** | Report Col 0 (Line 2) | Primary Key |
| **case_name** | Report Col 0 (Line 1) | Display Label |
| **region** | Report Col 0 (Line 0) | Grouping |
| **report_time** | Report Col 1 (Line 0) | Chronology |
| **report_issue** | Report Col 1 (Line 2) | Description |
| **repair_status** | Report Col 4 (Line 0) | Lifecycle State |
| **address** | Project List | Lookup by CaseNo/Name (Nullable) |
| **contact_name** | N/A | **MISSING** - Needs new source |
| **contact_phone** | N/A | **MISSING** - Needs new source |
