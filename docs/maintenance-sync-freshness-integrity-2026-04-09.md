# maintenance / sync freshness + integrity

## 漏洞主因

這次「顯示同步時間是最新，但內容不是最新全集」不是單一問題，而是三層一起造成：

1. `browser` 同步來源長期讀的是舊的 `north-reports.normalized.json`
   - 這份檔案只有 `北區 + 處理中 = 9 筆`
   - 不是真正的 `北區 + 待處理 + 處理中 + 全部時間` 全集

2. 同步寫入遇到新 case 時，`external_maintenance_tickets.id` 沒有自動補值
   - 舊 9 筆因為 DB 已存在而看起來能同步成功
   - 一旦要寫入新的全集 case，upsert 會因 `id` 為空而失敗

3. `/maintenance` 曾用 `last_success_at - 5 分鐘` 去裁切 current batch
   - 即使 DB 還有較舊但仍 active 的工單，頁面也只顯示最近那批
   - UI 主時間又顯示同步時間，容易造成「最新但不完整」假象

## 修法

這次採最小修正：

1. `browser` 同步來源改成只接受完整全集基準
   - 檔案：`tmp/browser-north-pending-in-progress-all-time.normalized.json`
   - 必須同時滿足：
     - `source = browser-live-page`
     - `view = browser-list`
     - `territory = 北區`
     - `included_statuses` 包含 `待處理`、`處理中`
     - `all_time = true`
     - `generatedAt` 未超過 `MAINTENANCE_BROWSER_FULL_BASELINE_MAX_AGE_MINUTES`，預設 60 分鐘

2. 新 external ticket 進 DB 前主動補 `id`
   - 讓全集同步遇到新 case 不會再因為 `id` 為空而失敗

3. 舊 active 但已不在本次完整來源中的列，改標成 `missing_from_source`
   - 不再留在 active 集合裡污染 `/maintenance`

4. `/maintenance` 不再只讀 current batch
   - 改為讀該 source system 的全部 active rows

5. UI 主時間語意調整
   - `sync-last-time` 現在代表 `maintenance_north_sync_status.last_success_at`
   - `sync-last-attempt-label` 代表 `maintenance_north_sync_status.last_sync_at`

## 「最後更新時間」現在代表什麼

- `sync-last-time`
  - 代表最後一次**成功完成完整同步**的時間
  - 來源：`maintenance_north_sync_status.last_success_at`

- `sync-last-attempt-label`
  - 代表最近一次同步嘗試時間，不論成功或失敗
  - 來源：`maintenance_north_sync_status.last_sync_at`

## 什麼情況下不能顯示同步成功 / 最新

只要有以下任一項，就不能更新 `last_success_at`：

- browser 全集基準不符合完整視角條件
- browser 全集基準過舊
- sync 寫入過程失敗
- 舊 active rows 無法正確標成 `missing_from_source`

在這些情況下，只能更新 `last_sync_at`，並維持 `status = failed`。

## 這次驗證怎麼做

1. 先重建 browser 全集基準
   - `北區 + 待處理 + 處理中 + 全部時間`

2. 再跑 maintenance 同步鏈路
   - 指令：`npm run verify:maintenance-sync`

3. 驗證通過標準
   - `browserCount = 30`
   - `syncedCount = 30`
   - `matchingCaseCount = 30`
   - `browserOnlyCount = 0`
   - `syncedOnlyCount = 0`
   - `region/work_date/complete_date different = 0`
   - `page sync-last-time = last_success_at`

## 本次通過結果

- browser baseline：30
- synced active：30
- matching：30
- browser only：0
- synced only：0
- `missing_from_source`：11
- `sync-last-time` 與 `last_success_at` 一致

結論：

- 這次已補起「只更新時間、沒更新完整內容」的漏洞
- 現在 UI 主時間只代表最後一次成功完整同步，不再代表僅僅一次嘗試
