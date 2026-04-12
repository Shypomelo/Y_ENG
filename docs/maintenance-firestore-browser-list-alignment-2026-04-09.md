# maintenance / Firestore 直讀線 browser-list 對齊說明

## 目的

這份文件把 Firestore 直讀線目前已驗證完成的 browser-list 視角對齊規則正式化，讓下一個視窗可以直接接手 reader、compare 與 verify。

這一輪只處理「讀取、比對、驗證」。
沒有碰 writeback，沒有改 `/maintenance` 同步主流程，沒有補 UI。

## 為什麼 27 vs 9 其實不是集合衝突

先前看到的 `27 vs 9`，本質上不是 Firestore 與 browser 的集合定義不同，而是視角不同：

- Firestore 直讀北區全部時間快照：27 筆
- 其中 `處理中`：9 筆
- 其中 `待處理`：18 筆
- 歷史 browser 子集合 baseline：`maintenance-probe/probe-output/console/north-reports.normalized.json`
  - 定義：北區 + 處理中 + 全部時間（9 筆子集合）
- 正式 browser 全集 baseline：`tmp/browser-north-pending-in-progress-all-time.normalized.json`
  - 定義：北區 + 待處理 + 處理中 + 全部時間

所以 `27 vs 9` 是 status filter 視角差，不是資料主鍵衝突。

正式 compare 時，必須先把 Firestore reader 切到和 browser 相同的視角：

- territory = `北區`
- repair_status = `處理中`
- 時間 = 全部時間

## browser 列表真正 render 的欄位規則

### region

browser 列表 header 是：

- `[territory] + 短地址`

原始碼位置：

- [report-crud-inline-script.js](/d:/工程系統/tmp/report-crud-inline-script.js#L1731)

短地址規則來自列表 render 內對 `address` 的縮寫處理，最終組成 `locationHeader`。

### 日期欄位

browser 列表第 5 欄實際 render 的是：

- 第 1 行：`repairStatus`
- 第 2 行：`repairEndDate || '---'`

原始碼位置：

- [report-crud-inline-script.js](/d:/工程系統/tmp/report-crud-inline-script.js#L1771)

因此 browser-list 視角下，正式採用：

- `browser_list_date_line2 = repairEndDate || '---'`
- `complete_date = ""`

原因是列表第 5 欄沒有第 3 行，normalized 後 `complete_date` 只能固定為空字串。

## 為什麼 repairStartDate 不該直接映射成列表 work_date

`repairStartDate` 雖然存在於資料中，但它不是 browser 列表第 5 欄 render 的內容。

它只在點選 row 後被塞進表單 input，不是列表顯示值。

原始碼位置：

- [report-crud-inline-script.js](/d:/工程系統/tmp/report-crud-inline-script.js#L1846)
- [report-crud-inline-script.js](/d:/工程系統/tmp/report-crud-inline-script.js#L1847)

所以若目標是對齊 browser-list 視角，就不能再把 `repairStartDate` 直接輸出成列表 `work_date`。

正式規則是：

- `work_date` 對齊 browser 列表第 5 欄第 2 行
- 也就是 `repairEndDate || '---'`
- `repairStartDate` 只保留在 source evidence，例如 `source_repairStartDate`

## compare 正式規則

compare key 維持不變：

- `case_no + report_time + normalized(report_issue)`

compare 輸出必須固定帶出：

- `compareView = "browser-list"`
- `fieldSemantics.region`
- `fieldSemantics.work_date`
- `fieldSemantics.complete_date`
- `fieldSemantics.browser_list_date_line2`

這是為了讓後續接手的人知道，目前比對的是 browser 列表 render 語意，不是 Firestore 原始欄位語意。

## snapshot-remap 與 live Firestore run 的差別

### live Firestore run

使用條件：

- shell session 內存在 `FIREBASE_EMAIL`
- shell session 內存在 `FIREBASE_PASSWORD`

行為：

- reader 直接登入 Firebase Auth
- 直接讀 `operations` 與其 `logs`
- 依 browser-list 視角產出 normalized json

### snapshot-remap

使用條件：

- 缺少 live credentials

行為：

- reader 改讀既有 Firestore snapshot
- 再依 browser-list 視角重整欄位語意
- compare 與 verify 仍可驗證「browser-list 視角下是否對齊」

限制：

- snapshot-remap 不是最新線上 Firestore 拉取
- 它證明的是「目前手上快照在 browser-list 視角下可否收斂」

## 目前仍未做的事

- writeback
- `/maintenance` 寫入流程調整
- `/maintenance` 同步主流程調整
- UI 顯示改動

本輪刻意不處理這些項目。

## 目前正式產物

- Reader：
  [firestore-north-sync-reader.js](/d:/工程系統/tmp/firestore-north-sync-reader.js)

- Compare：
  [compare-firestore-vs-browser-north.js](/d:/工程系統/tmp/compare-firestore-vs-browser-north.js)

- Verify：
  [verify-firestore-browser-list-alignment.ps1](/d:/工程系統/tmp/verify-firestore-browser-list-alignment.ps1)

## 驗證標準

在 `北區 + 處理中 + 全部時間` 的 browser-list 視角下，至少要看到：

- `browserCount`
- `firestoreCount`
- `matchingCaseCount`
- `browserOnlyCount`
- `firestoreOnlyCount`
- `fieldAgreementSummary.region`
- `fieldAgreementSummary.work_date`
- `fieldAgreementSummary.complete_date`

若缺少 live credentials，verify 必須明講 fallback 到 snapshot-remap，不能把結果寫成 live Firestore 驗證成功。

## baseline 使用規則

- `maintenance-probe/probe-output/console/north-reports.normalized.json`
  - 只可視為：北區 + 處理中 + 全部時間（9 筆子集合）
  - 不可再誤當成 `north_pending_all_time` 或正式 browser 全集 baseline
- `tmp/browser-north-pending-in-progress-all-time.normalized.json`
  - 正式 browser 全集 baseline
  - compare / verify 若要驗全集，應以這份為主
