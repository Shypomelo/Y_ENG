# maintenance Firestore 只讀盤點（2026-04-07）

## 1. 已證實事實

### 1.1 `report_crud` 頁面確實使用 Firebase / Firestore / Auth
- 證據：`maintenance-probe/probe-output/debug/reports-load.json`
- 內含頁面 inline module import：
  - `firebase-app.js`
  - `firebase-firestore.js`
  - `firebase-auth.js`
- 同一段 import 已出現：
  - `getFirestore`
  - `collection`
  - `getDocs`
  - `getDoc`
  - `addDoc`
  - `updateDoc`
  - `deleteDoc`
  - `onSnapshot`
  - `query`
  - `limit`
  - `where`
  - `orderBy`
  - `startAfter`

### 1.2 `report_crud` 畫面資料是動態載入，不是靜態 HTML
- 證據：`maintenance-probe/probe-output/debug/reports-load.json`
- `#reportDataList` 初始為 0 筆，之後在 polling 過程變成 28 筆。
- 這代表畫面表格內容是頁面完成後才灌入。

### 1.3 合法登入 session 確實會打 Firebase 相關服務
- 證據：
  - `tmp/north-report-probe-profile/Default/Network/Network Persistent State`
  - `tmp/north-live-login-profile/Default/Network/Network Persistent State`
  - `tmp/north-live-verify-profile/Default/Network/Network Persistent State`
- 可直接看到：
  - `firestore.googleapis.com`
  - `identitytoolkit.googleapis.com`
  - `securetoken.googleapis.com`

### 1.4 `report_crud` 畫面至少有「區域」與「狀態」兩層前端篩選
- 證據：`tmp/report-crud-control-tree.json`
- 可直接看到 automation id：
  - `filter-territories`
  - `filter-statuses`
  - `view-report-crud-container`
- 可直接看到狀態文字：
  - `待處理`
  - `處理中`

### 1.5 專案主資料存在本機快取鍵
- 證據：
  - `tmp/north-live-login-profile/Default/Local Storage/leveldb/000008.ldb`
  - `tmp/north-report-probe-profile/Default/Local Storage/leveldb/000008.ldb`
- 可直接搜尋到鍵名：
  - `sg_ops_projects_cache`
  - `sg_ops_projects_timestamp`
  - `sg_ops_projects_d`
- 這能證明「案場/專案主資料」有被前端快取，但目前沒有同等級證據證明 `report_crud` 工單列表也用相同命名規則快取。

## 2. 畫面欄位對應

### 2.1 `report_crud` 一列資料目前可穩定拆出的欄位
- 證據：
  - `maintenance-probe/ops-console.js`
  - `maintenance-probe/probe-output/console/north-reports.normalized.json`
    - 歷史定義：北區 + 處理中 + 全部時間（9 筆子集合）
  - `tmp/browser-north-pending-in-progress-all-time.normalized.json`
    - 正式 browser 全集 baseline：北區 + 待處理 + 處理中 + 全部時間
  - `lib/maintenance/external-ticket-normalizer.ts`
- 目前可穩定拆出：
  - `region`
  - `case_name`
  - `case_no`
  - `report_time`
  - `reporter`
  - `report_issue`
  - `monitor_staff`
  - `monitor_judgement`
  - `monitor_note`
  - `repair_staff`
  - `repair_note`
  - `repair_status`
  - `work_date`
  - `complete_date`

### 2.2 `report_crud` 畫面欄位對應候選
| 畫面區塊 | 目前欄位候選 | 證據來源 |
| --- | --- | --- |
| 案場欄 | `region`, `case_name`, `case_no` | `parseReportRowFromCells()` |
| 通報欄 | `report_time`, `reporter`, `report_issue` | `parseReportRowFromCells()` |
| 判讀欄 | `monitor_staff`, `monitor_judgement`, `monitor_note` | `parseReportRowFromCells()` |
| 維修欄 | `repair_staff`, `repair_note` | `parseReportRowFromCells()` |
| 狀態欄 | `repair_status`, `work_date`, `complete_date` | `parseReportRowFromCells()`；browser-list 語意為 `work_date = repairEndDate \|\| '---'`、`complete_date = ""` |

### 2.3 `/maintenance` 現在實際採用的來源欄位
- 證據：`lib/maintenance/external-ticket-normalizer.ts`
- 同步主線目前把外部欄位寫入：
  - `source_region`
  - `source_case_no`
  - `source_case_name`
  - `source_report_time`
  - `source_reporter`
  - `source_report_issue`
  - `source_issue_summary`
  - `source_monitor_staff`
  - `source_monitor_judgement`
  - `source_monitor_note`
  - `source_repair_status`
  - `source_repair_staff`
  - `source_repair_note`
  - `source_work_date`
  - `source_complete_date`

## 3. 資料結構盤點

### 3.1 維修記錄怎麼掛在案場底下
- 已證實：
  - 每筆 `report_crud` 列都帶有 `case_no`、`case_name`、`region`。
  - 每筆列資料都可以對回案場識別資訊，而不是獨立無案場資訊的平面事件。
- 目前可成立的只讀結論：
  - Firestore 中的維修記錄至少「邏輯上」是關聯到案場的。
  - 但 repo 內目前沒有直接抓到 Firestore 實際 path，所以還不能證實是：
    - `projects/{projectId}/reports/{reportId}`
    - 還是獨立 collection 再用 `projectId / projectNumber / case_no` 關聯。

### 3.2 document id 和資料欄位 `id` 的關係
- 已證實：
  - 專案快取資料內有 `id` 欄位痕跡，且同時看得到 `projectNumber` 等欄位字樣，代表專案主資料很可能有一個內部 document id，再搭配案號欄位。
- 尚未證實：
  - `report_crud` 每筆維修記錄的 Firestore document id。
  - 畫面列上的欄位 `id` 是否等於 Firestore doc id。
  - 畫面列是否根本沒有把 doc id 暴露到 DOM。
- 目前結論：
  - `case_no` 不是唯一能證實的 Firestore document id。
  - `case_no` 比較像案場/案號欄位，不是維修記錄本身 doc id。

### 3.3 待處理 / 已完成是靠哪個欄位表示
- 已證實：
  - 前端有 `filter-statuses`。
  - 畫面存在 `待處理`、`處理中` 兩個可視篩選值。
  - `parseReportRowFromCells()` 把最後一欄第一行拆成 `repair_status`。
- 目前最強證據結論：
  - 畫面狀態值直接對應到 `repair_status` 這個外顯欄位候選。
  - `待處理 / 處理中 / 已完成` 應屬同一份維修資料的狀態欄位值，而不是不同表。
- 尚未證實：
  - Firestore 原始欄位名稱是否真的就叫 `repair_status`。
  - `已完成` 是否還帶有第二條件，例如 `complete_date` 非空。

## 4. collection / subcollection 結構候選

### 4.1 目前可證實到的層級
- 有 Firebase Auth session。
- 有 Firestore query 能力。
- 有案場主資料快取：`sg_ops_projects_*`。
- 有維修列表動態灌入 `#reportDataList`。

### 4.2 目前只能列候選，不能定案
| 類別 | 候選 | 狀態 |
| --- | --- | --- |
| 專案 collection | `projects` 或同義結構 | 候選，未直接抓到 Firestore path |
| 維修子集合 | `projects/{projectId}/reports` 類型 | 候選，未直接抓到 Firestore path |
| 維修獨立集合 | `reports` / `maintenanceReports` / `opsReports` 類型 | 候選，未直接抓到 Firestore path |

## 5. 工單唯一鍵候選

### 5.1 目前有證據支持的候選
| 候選鍵 | 判斷 | 證據 |
| --- | --- | --- |
| Firestore document id | 最理想，但目前未抓到 | 頁面有 Firestore，但 repo 內無 doc path 證據 |
| `case_no + report_time + report_issue` | 可做業務層去重候選 | 畫面穩定可拆出這三組值 |
| `region + case_name + case_no + report_time + hash(report_issue)` | 目前 repo 主線實際使用 | `lib/maintenance/external-ticket-normalizer.ts` 的 `fallback_key` |

### 5.2 目前不建議定案成唯一鍵的欄位
- 單獨 `case_no`
  - 原因：這看起來是案場/案號，不像單筆維修記錄 id。
- 單獨 `case_name`
  - 原因：同案場可能多次報修。

## 6. 狀態欄位候選

### 6.1 一級候選
- `repair_status`
  - 證據最強。
  - 畫面狀態篩選與列最後一欄第一行直接對應。

### 6.2 二級輔助欄位
- `work_date`
- `complete_date`
  - 可能是狀態輔助判斷。
  - 但目前沒有證據能證明前端是用它們直接分流待處理/已完成。

## 7. 這輪不能定案的地方
- 真實 Firestore collection 名稱
- 真實 Firestore document path
- 維修記錄到底是子集合還是獨立集合
- `report_crud` 每列的 document id
- Firestore 原始欄位名是否與畫面拆出的欄位名完全一致

## 8. 這輪可直接採用的精簡 mapping

### 8.1 可能的 collection / subcollection 結構
- 專案主資料存在一層 project collection 或等價結構
- 維修資料與案場有關聯
- 但目前不能證明是 subcollection 還是獨立 collection

### 8.2 工單唯一鍵候選
- 第一候選：Firestore document id（尚未抓到）
- 目前可落地候選：`region + case_name + case_no + report_time + hash(report_issue)`

### 8.3 狀態欄位候選
- 第一候選：`repair_status`
- 輔助欄位：`work_date`, `complete_date`

### 8.4 report_crud 畫面欄位對應候選
- 案場：`region`, `case_name`, `case_no`
- 通報：`report_time`, `reporter`, `report_issue`
- 判讀：`monitor_staff`, `monitor_judgement`, `monitor_note`
- 維修：`repair_staff`, `repair_note`
- 狀態：`repair_status`, `work_date`, `complete_date`
