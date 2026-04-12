# 維運工單外部同步 Phase 1 任務清單

## 目標

在不做回寫、不做新 UI 的前提下，完成外部工單正式同步入本地，並讓 `/maintenance` 改讀同步主表。

## 任務項目

1. 擴充 probe，完整探勘 `report_crud` 的穩定識別資訊
- 保存 row outerHTML
- 保存 row dataset
- 保存 clickable element `onclick`
- 保存 modal 開啟後的 hidden state
- 嘗試取得 Firestore doc path / document id

2. 建立 external sync 主表 migration
- 新增 `external_maintenance_tickets`
- 為 `maintenance_reports` 加上 external 關聯欄位
- 補齊 unique/index 與狀態欄位

3. 建立 normalize 模組
- 把外部欄位整理成標準 payload
- 生成 `source_payload_hash`
- 生成 `fallback_key`
- 計算 `is_north`

4. 建立 repository / upsert 邏輯
- 支援 `(source_system, external_id)` upsert
- 支援 fallback key upsert
- 未變更 payload 時只更新 `last_seen_at`
- payload 變更時更新外部主資料與 `last_synced_at`

5. 建立同步入口
- 新增 server action 或 script 觸發同步
- 將 probe 輸出導入 `external_maintenance_tickets`

6. 切換 `/maintenance` pending 讀取來源
- 從 `north-reports.normalized.json` 切換到 `external_maintenance_tickets`
- 補註：`north-reports.normalized.json` 只代表歷史的北區 + 處理中 + 全部時間子集合，不是正式 browser 全集 baseline
- 只讀 `is_north = true and sync_status = 'active'`

7. 驗證同步正確性
- 驗證同一筆工單重跑同步不會重複匯入
- 驗證外部欄位變更會覆蓋外部同步主表
- 驗證北區工單可正確出現在 `/maintenance`

## 完成條件

- 不再使用 `north-${index}` 作為正式識別
- 本地已有 `external_maintenance_tickets`
- `/maintenance` pending 已改讀正式同步來源
- external id 若已找到，正式使用 `external_id`
- external id 若仍未找到，暫時使用 fallback key 僅支撐單向同步
