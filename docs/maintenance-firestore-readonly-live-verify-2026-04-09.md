# maintenance / Firestore readonly live verify 2026-04-09

## 結果

本次 **不是 live Firestore 成功驗證**。

本輪已再次用既有 browser-list 視角 verify 流程實際執行，包含升權環境檢查與：

- `npm run verify:maintenance-firestore-readonly`

實際結果仍然顯示：

- `mode = snapshot-remap`

代表目前 shell session 仍然沒有：

- `FIREBASE_EMAIL`
- `FIREBASE_PASSWORD`

因此這次 live verify 的失敗點是：

- `auth precondition missing`

也就是說，卡點在 **auth**，不是：

- Firestore read
- compare mismatch
- browser-list mapping

## 本次實際輸出

正式 verify artifact：

- [verify-firestore-browser-list-alignment.json](/d:/工程系統/tmp/verify-firestore-browser-list-alignment.json)

其中模式為：

- `mode = snapshot-remap`
- 不是 `mode = live-firestore`

真數字：

- `browserCount = 9`
- `firestoreCount = 9`
- `matchingCaseCount = 9`
- `browserOnlyCount = 0`
- `firestoreOnlyCount = 0`

欄位一致性摘要：

- `region: same 9 / different 0`
- `work_date: same 9 / different 0`
- `complete_date: same 9 / different 0`

失敗分類：

- `auth`

## 最終判定

### 是否已具備「readonly 正式來源候選」條件

是。

原因：

- browser-list 視角 mapping 已固化
- snapshot-remap verify 已穩定收斂為 0 差異
- maintenance 同步入口已可切到 `firestore-readonly`

### 是否已具備「可放心預設切換」條件

否。

剩餘阻塞點只有一個：

- 尚未完成一次真正的 `live-firestore` 驗證

## 是否建議把 `MAINTENANCE_NORTH_SYNC_SOURCE` 預設切過去

目前 **不建議**。

原因不是資料 mismatch，而是 live Firestore auth 還沒打通，缺少最後一次 live verify 證據。
