# 維運工單外部同步規格 v1

## 1. 完成摘要

本規格定義外部維運工單從公司系統 `sg_ops.html?view=report_crud` 同步進本地系統的正式方案。
這一版只處理規格、DB 設計、同步流程、衝突規則與分階段實作切分，不包含 UI 實作，也不包含回寫實作。

本規格的核心原則如下：

- 外部系統是 `source of truth`
- `/maintenance` 不再長期依賴 `north-reports.normalized.json` 作為正式資料來源
- 外部資料必須先同步進本地外部主表，再提供 `/maintenance` 使用
- 可回寫欄位在回寫前，必須先同步最新外部資料並重新比對
- 若外部已更新且本地尚未重新比對，必須暫停回寫並標示衝突

---

## 2. 現況整理

### 2.1 外部來源

- 公司系統網址：`https://solargarden-web-prod.web.app/main.html`
- 維運目標頁：`sg_ops.html?view=report_crud`
- 目前抓取方式：Playwright 登入後進 iframe 抓 DOM 表格
- 現有 probe 輸出：
  - 全量：`maintenance-probe/probe-output/console/maintenance-reports.normalized.json`
  - 北區（歷史子集合，不是正式全集 baseline）：`maintenance-probe/probe-output/console/north-reports.normalized.json`
  - 正式 browser 全集 baseline：`tmp/browser-north-pending-in-progress-all-time.normalized.json`

### 2.2 本地落點

- 頁面模組：`/maintenance`
- 正式維修回報：`maintenance_reports`
- 待核料件：`maintenance_reconciliation`
- 庫存異動：`inventory_usage_logs`

### 2.3 已知問題

- 沒有穩定 `external_id`
- 目前 `north-${index}` 只是暫時 key，不能作為同步或回寫依據
- `/maintenance` 目前直接讀 probe JSON 快照，不是正式同步資料流
- `report_crud` 頁面是動態資料表，已知帶有 Firestore 腳本，但目前 repo 內沒有證據證明我們已抓到穩定 document id

---

## 3. 同步原則

### 3.1 Source of Truth

- 外部系統主資料永遠以外部為準
- 本地不可覆蓋外部主資料欄位
- 本地僅維護：
  - 同步控制欄位
  - 關聯欄位
  - 本地流程欄位
  - 回寫候選欄位與衝突狀態

### 3.2 外部主資料欄位

以下欄位視為外部主資料欄位，每次同步時應由外部覆蓋本地快取：

- `case_no`
- `case_name`
- `region`
- `report_time`
- `report_issue`
- `issue_summary`
- `reporter`
- `monitor_staff`
- `monitor_judgement`
- `monitor_note`
- `repair_status`
- `repair_staff`
- `repair_note`
- `work_date`
- `complete_date`
- `optimizer_count`

### 3.3 可回寫欄位

本輪定案可回寫欄位如下：

- `repair_status`
- `repair_staff`
- `repair_note`
- `work_date`
- `complete_date`

### 3.4 不可回寫欄位

以下欄位不得由本地回寫到外部：

- `case_no`
- `case_name`
- `region`
- `report_time`
- `report_issue`
- 其他來源主資料欄位

---

## 4. external id 策略

### 4.1 v1 必做檢查

必須先完整檢查 `sg_ops.html?view=report_crud` 是否存在穩定 external id。
檢查來源不得只看目前 normalize JSON，必須直接從目標頁與 runtime 取證。

必查來源：

- row `dataset`
- row / button / cell 的 `onclick`
- hidden input
- modal 開啟後的 hidden state
- iframe runtime state
- Firestore query 結果中的 document id
- collection path / doc path

### 4.2 目前已知事實

根據現有 probe artifacts，可確認：

- 通報清單 tbody 為 `#reportDataList`
- 該區資料列是動態載入，會從 0 列變成有資料列
- 頁面內有 Firebase Firestore 相關腳本

但目前還不能確認：

- DOM 是否已包含穩定 `data-id`
- row 上是否存在 hidden external id
- modal 是否能取到 document id
- 我們是否已攔到 Firestore document path

### 4.3 正式識別策略

#### Primary identity

若在 DOM / runtime / Firestore path 中找到穩定 id，正式唯一鍵採：

- `source_system + external_id`

這是唯一可支撐雙向同步與未來回寫的正式識別方式。

#### Fallback identity

若 Phase 1 仍找不到穩定 external id，允許先用 fallback key 支撐單向同步：

- `source_system`
- `normalized(region)`
- `normalized(case_name)`
- `normalized(case_no)`
- `normalized(report_time)`
- `hash(report_issue)`

組合後形成：

- `fallback_key`

### 4.4 fallback 風險

fallback key 只能支撐單向同步，不能視為穩定外部主鍵，風險包括：

- 案場名稱修正後可能斷鏈
- 同案同時間多筆通報可能碰撞
- 通報內容微調會導致 hash 改變
- 不適合作為回寫對象的永久識別

### 4.5 v1 結論

- Phase 1 可先接受 fallback key 上線單向同步
- Phase 3 若要啟用回寫，必須先驗明穩定 `external_id`
- 若始終找不到穩定 `external_id`，則回寫功能不得開啟

---

## 5. DB 設計建議

### 5.1 建議新增外部同步主表

建議新增：

- `external_maintenance_tickets`

用途：

- 作為外部工單的正式同步主表
- 作為 `/maintenance` pending 視圖的正式來源
- 作為本地維修回報與外部工單的關聯樞紐

### 5.2 `external_maintenance_tickets` 欄位建議

#### A. 識別欄位

- `id uuid primary key`
- `source_system text not null`
- `external_id text null`
- `fallback_key text not null`
- `is_fallback_identity boolean not null default true`
- `identity_confidence text not null`

#### B. 外部主資料欄位

- `source_region text`
- `source_case_no text`
- `source_case_name text`
- `source_report_time timestamptz null`
- `source_reporter text`
- `source_report_issue text`
- `source_issue_summary text`
- `source_monitor_staff text`
- `source_monitor_judgement text`
- `source_monitor_note text`
- `source_repair_status text`
- `source_repair_staff text`
- `source_repair_note text`
- `source_work_date date null`
- `source_complete_date date null`
- `source_optimizer_count integer null`

#### C. 原始同步與偵錯欄位

- `source_payload jsonb not null`
- `source_payload_hash text not null`
- `source_row_html text null`
- `source_dataset jsonb null`
- `source_runtime_meta jsonb null`

#### D. 同步控制欄位

- `is_north boolean not null default false`
- `sync_status text not null default 'active'`
- `first_seen_at timestamptz not null`
- `last_seen_at timestamptz not null`
- `last_synced_at timestamptz not null`
- `last_source_updated_at timestamptz null`

#### E. 本地關聯欄位

- `linked_maintenance_report_id uuid null`
- `linked_project_id uuid null`

#### F. 回寫控制欄位

- `writeback_eligible boolean not null default false`
- `writeback_status text not null default 'idle'`
- `writeback_candidate jsonb null`
- `writeback_last_checked_at timestamptz null`
- `writeback_last_attempt_at timestamptz null`
- `writeback_last_success_at timestamptz null`
- `writeback_error text null`

#### G. 衝突控制欄位

- `conflict_status text not null default 'clean'`
- `conflict_detail jsonb null`

### 5.3 現有表調整建議

#### `maintenance_reports`

建議新增：

- `external_ticket_id uuid null references external_maintenance_tickets(id)`
- `external_identity_snapshot text null`
- `external_payload_hash_at_bind text null`
- `external_last_compared_at timestamptz null`
- `external_conflict_status text not null default 'clean'`

用途：

- 記錄本地報告綁定的是哪一張外部工單
- 記錄綁定當下對照到的 identity 與 payload hash
- 記錄本地是否已重新比對外部最新內容

#### `maintenance_tickets`

建議不要再承擔外部同步主入口責任。
若保留，應定位為內部派工或 UI 快取資料，不作為外部工單主資料表。

### 5.4 索引建議

- unique `(source_system, external_id)` where `external_id is not null`
- unique `(source_system, fallback_key)`
- index `(is_north, sync_status)`
- index `(source_case_no)`
- index `(source_case_name)`
- index `(writeback_status)`
- gin index on `source_payload`

---

## 6. 同步流程

### 6.1 正式流程

1. 外部抓取
2. normalize
3. identity resolve
4. upsert `external_maintenance_tickets`
5. 北區標記
6. `/maintenance` 讀外部同步主表

### 6.2 流程細節

#### Step 1：外部抓取

由 Playwright 進入 `report_crud` 頁，等待 `#reportDataList` 完整載入後抓資料。
除了欄位值本身，還必須保留識別與除錯資訊：

- row outerHTML
- row dataset
- clickable element `onclick`
- modal hidden state
- Firestore doc path / document id

#### Step 2：Normalize

把外部欄位整理成統一 payload，至少包含：

- `case_name`
- `case_no`
- `region`
- `report_time`
- `report_issue`
- `repair_status`
- `repair_staff`
- `repair_note`
- `work_date`
- `complete_date`

並保留完整 `source_payload` 以利追查。

#### Step 3：Identity resolve

- 若找到穩定 `external_id`，使用 `external_id`
- 否則產生 `fallback_key`
- 同步寫入 `is_fallback_identity` 與 `identity_confidence`

#### Step 4：Upsert

以 `(source_system, external_id)` 或 `(source_system, fallback_key)` 進行 upsert。

避免重複匯入的關鍵規則：

- 每筆都先做 identity resolve
- 依 identity 進行 upsert，不新增重複資料
- 若 `source_payload_hash` 未改變，只更新 `last_seen_at`
- 若 `source_payload_hash` 已改變，更新外部主資料並更新 `last_synced_at`

#### Step 5：北區標記

北區過濾不應參與 identity。
它應該是同步後的業務標記。

規則：

- `source_region includes '北區'`
- 寫入 `is_north = true`

未來若北區規則擴充，也只調整標記邏輯，不影響主鍵與歷史關聯。

#### Step 6：本地模組取用

`/maintenance` pending 清單改讀：

- `external_maintenance_tickets`
- `where is_north = true and sync_status = 'active'`

不再直接讀 `north-reports.normalized.json`

### 6.3 外部更新覆蓋本地規則

當外部資料更新時：

- `external_maintenance_tickets` 的外部主資料欄位一律覆蓋
- 若已綁定本地 `maintenance_reports`
  - 必須重新比對本地可回寫欄位
  - 若尚未重比對，將 `external_conflict_status` 標為 `needs_refresh` 或 `conflict`

---

## 7. 回寫流程設計

本節只定義設計，不進行實作。

### 7.1 本地可準備回寫的欄位

當本地維修流程更新以下欄位時，可形成 `writeback_candidate`：

- `repair_status`
- `repair_staff`
- `repair_note`
- `work_date`
- `complete_date`

### 7.2 回寫前檢查

回寫前必須執行：

1. 重新同步最新外部工單
2. 重新計算 `source_payload_hash`
3. 比對：
   - 外部最新主資料
   - 本地綁定快照
   - 本地待回寫欄位
4. 若外部已變動且本地未重新比對：
   - `writeback_status = 'blocked_conflict'`
   - `conflict_status = 'conflict'`
   - 暫停回寫

### 7.3 衝突標示規則

衝突標示至少要能分辨：

- 外部主資料已更新
- 本地綁定快照已過期
- 目前是 `fallback_key` 身分，不允許回寫
- 可回寫欄位與外部最新值有差異但尚未人工確認

### 7.4 狀態建議

`external_maintenance_tickets` 與 `maintenance_reports` 可共用以下衝突狀態：

- `clean`
- `needs_refresh`
- `conflict`

---

## 8. 分階段實作建議

### Phase 1：穩定同步入本地

目標：

- 建立外部同步主表
- 完成 normalize + identity resolve + upsert
- 讓 `/maintenance` pending 正式改讀同步主表

會改的模組：

- `maintenance-probe/ops-console.js`
- `maintenance-probe/extract.js`
- `scripts/probe-maintenance-external-id.ts`
- `supabase/migrations/*`
- `lib/repositories/external-maintenance-tickets.ts`
- `lib/maintenance/external-ticket-normalizer.ts`
- `lib/maintenance/external-ticket-merge.ts`
- `app/maintenance/actions.ts`
- `app/maintenance/page.tsx`

這一階段不做：

- 回寫
- 新 UI

### Phase 2：同步紀錄與差異檢查

目標：

- 建立 payload hash 比對
- 建立綁定快照
- 建立衝突檢查與差異比對服務

會改的模組：

- `lib/maintenance/external-ticket-conflict.ts`
- `lib/repositories/external-maintenance-tickets.ts`
- `app/maintenance/actions.ts`
- `lib/types/database.ts`
- `maintenance_reports` 對應 repository / query

### Phase 3：有限欄位回寫

目標：

- 只對定案五個欄位開放回寫
- 回寫前必做最新同步與衝突檢查

前置條件：

- 穩定 `external_id` 已確認
- 衝突檢查可正確阻擋過期資料
- 回寫流程已有 retry / failure state 設計

---

## 9. 主要風險

### 9.1 找不到穩定 external id

- 只能做單向同步
- 難以安全對應多次更新的同一筆工單
- 無法啟用正式回寫

### 9.2 Playwright + DOM 抓取脆弱

- 頁面結構變動就可能抓不到欄位
- iframe 行為改變可能導致等待時機失效
- DOM 層沒有穩定 id 時，會逼我們依賴 runtime 探勘

### 9.3 北區字串判斷風險

- 目前只靠 `includes('北區')`
- 若外部改成縮寫、代碼、空白差異或其他文案，可能誤判

### 9.4 Firestore 動態載入風險

- 目前只知道頁面疑似經由 Firestore 載入資料
- 若最後仍拿不到 document id，fallback 方案只能支撐單向同步
- Phase 1 必須先完成 external id 探勘

---

## 10. v1 交付內容

v1 規格完成後，應至少交付：

- external sync 主表 DB 設計
- stable external id 探勘策略
- fallback key 方案與風險說明
- 外部抓取到本地同步的正式流程
- 外部更新覆蓋本地的規則
- 回寫前衝突檢查設計
- 分階段實作切分

下一步即可直接進入 Phase 1 實作。
