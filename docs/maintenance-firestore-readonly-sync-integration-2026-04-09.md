# maintenance / Firestore readonly 同步入口接入說明

## 本輪做了什麼

本輪把 Firestore readonly 的 browser-list 對齊成果，正式接進 maintenance 北區同步入口。

接入點是：

- [actions.ts](/d:/工程系統/app/maintenance/actions.ts)
  - `syncMaintenanceNorthReportsAction()`
  - `syncNorthReportsSnapshotToExternalStore()`
  - `readPendingNorthReportsFromExternalStore()`

這次沒有碰寫入回 Firestore。
這次也沒有改 `/maintenance` UI 結構、schedule 或 writeback。

## 目前支援的同步來源

### 1. `browser`

沿用既有流程：

- 讀 `tmp/browser-north-pending-in-progress-all-time.normalized.json`
  - 正式定義：北區 + 待處理 + 處理中 + 全部時間
  - 舊的 `maintenance-probe/probe-output/console/north-reports.normalized.json` 只可視為「北區 + 處理中 + 全部時間（9 筆子集合）」歷史 baseline
- 經 `normalizeNorthReportRows()`
- 再進 external store merge / upsert

### 2. `firestore-readonly`

新增 readonly 候選來源：

- 透過 [firestore-north-sync-reader.js](/d:/工程系統/tmp/firestore-north-sync-reader.js)
  產出 browser-list 視角對齊後的 normalized json
- 再走同一條 `normalizeNorthReportRows() -> merge -> upsert`

這代表 maintenance 同步入口已能接 readonly Firestore 來源，但仍然不做任何 writeback。

## 如何切換 `browser / firestore-readonly`

目前用最小內部開關，不做新 UI。

優先順序：

1. action 直接傳入 source override
2. env `MAINTENANCE_NORTH_SYNC_SOURCE`
3. 預設 `browser`

可用值：

- `browser`
- `firestore-readonly`

如果要切成 Firestore readonly 候選來源，可在 shell / runtime 設：

```powershell
$env:MAINTENANCE_NORTH_SYNC_SOURCE='firestore-readonly'
```

## 為什麼要做 source_system 分流

browser 與 firestore-readonly 兩條來源都使用 fallback key。

若不做來源分流，merge 與 list 階段可能把不同來源誤當成同一筆。

本輪已正式做兩件事：

- normalizer 支援不同 `source_system`
- repository 的 lookup / list 支援依 `source_system` 過濾

因此：

- 舊 `browser` 流程可以保留
- 新 `firestore-readonly` 可以並存
- 讀取端會依目前配置來源取資料，不會把兩邊混在一起

## browser-list 視角規則

正式接入時直接沿用已定案 mapping：

- `region = [territory] + 短地址`
- `browser_list_date_line2 = repairEndDate || '---'`
- `work_date = browser_list_date_line2`
- `complete_date = ""`
- `repairStartDate` 不直接映射成 browser 列表 `work_date`

所以正式同步入口不會再退回 `repairStartDate` 視角。

## live verify 與 snapshot-remap verify

### live Firestore verify

前提：

- shell 有 `FIREBASE_EMAIL`
- shell 有 `FIREBASE_PASSWORD`

行為：

- reader 直接登入 Firebase Auth
- 直接讀 Firestore operations / logs

### snapshot-remap verify

前提：

- 缺少 live credentials

行為：

- reader 使用現有 Firestore snapshot
- 重新套用 browser-list 視角 mapping
- compare / verify 仍可驗證欄位與集合是否對齊

本輪實際跑的是 `snapshot-remap`，不是 live。

## 本輪仍未做的事

- writeback
- Firestore 回寫
- `/maintenance` 主 UI 顯示新 source 標籤
- 排程切換成 Firestore readonly
- archive / 歷史來源整理

## 下一步若要推進成正式來源，還差什麼

1. 補齊 `FIREBASE_EMAIL / FIREBASE_PASSWORD`
2. 用同一套 verify 跑一次 live Firestore 驗證
3. 確認 live 路徑也維持：
   - `browserCount = firestoreCount`
   - `matchingCaseCount` 收斂
   - `region / work_date / complete_date` 一致性為 0 差異
4. 若 live 穩定，再決定是否把 `MAINTENANCE_NORTH_SYNC_SOURCE` 預設改成 `firestore-readonly`

## 相關 artifacts

- [firestore-north-sync-reader.js](/d:/工程系統/tmp/firestore-north-sync-reader.js)
- [compare-firestore-vs-browser-north.js](/d:/工程系統/tmp/compare-firestore-vs-browser-north.js)
- [verify-firestore-browser-list-alignment.ps1](/d:/工程系統/tmp/verify-firestore-browser-list-alignment.ps1)
- [verify-firestore-browser-list-alignment.json](/d:/工程系統/tmp/verify-firestore-browser-list-alignment.json)
