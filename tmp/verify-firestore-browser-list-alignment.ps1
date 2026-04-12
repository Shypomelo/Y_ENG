$ErrorActionPreference = "Stop"

$workspace = Get-Location
$tmpDir = Join-Path $workspace "tmp"

$browserPath = Join-Path $workspace "tmp\browser-north-pending-in-progress-all-time.normalized.json"
$historicalSubsetPath = Join-Path $workspace "maintenance-probe\probe-output\console\north-reports.normalized.json"
$snapshotSourcePath = Join-Path $tmpDir "firestore-north-reports.normalized.json"
$readerScript = Join-Path $tmpDir "firestore-north-sync-reader.js"
$compareScript = Join-Path $tmpDir "compare-firestore-vs-browser-north.js"
$firestoreOutputPath = Join-Path $tmpDir "firestore-north-reports.in-progress.browser-list.normalized.json"
$compareOutputPath = Join-Path $tmpDir "firestore-vs-browser-north-compare.in-progress.browser-list.json"
$verifyOutputPath = Join-Path $tmpDir "verify-firestore-browser-list-alignment.json"

$targetTerritory = [string]::Concat([char]0x5317, [char]0x5340)
$inProgressStatus = [string]::Concat([char]0x8655, [char]0x7406, [char]0x4E2D)

$hasLiveCreds = [bool](
  (($env:FIREBASE_EMAIL) -or ($env:COMPANY_EMAIL)) -and
  (($env:FIREBASE_PASSWORD) -or ($env:COMPANY_PASSWORD))
)

$readerEnv = @{
  FIRESTORE_TARGET_TERRITORY = $targetTerritory
  FIRESTORE_REPAIR_STATUS    = $inProgressStatus
  OUTPUT_PATH                = $firestoreOutputPath
}

if (-not $hasLiveCreds) {
  $readerEnv['SOURCE_JSON_PATH'] = $snapshotSourcePath
}

foreach ($entry in $readerEnv.GetEnumerator()) {
  Set-Item -Path ("Env:{0}" -f $entry.Key) -Value $entry.Value
}

try {
  & node $readerScript | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Reader failed with exit code $LASTEXITCODE"
  }

  $env:BROWSER_PATH = $browserPath
  $env:FIRESTORE_PATH = $firestoreOutputPath
  $env:OUTPUT_PATH = $compareOutputPath
  $env:COMPARE_REPAIR_STATUS = $inProgressStatus

  & node $compareScript | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Compare failed with exit code $LASTEXITCODE"
  }

  $summaryJson = @'
const fs = require("fs");
const [firestorePath, comparePath] = process.argv.slice(2);
const firestoreJson = JSON.parse(fs.readFileSync(firestorePath, "utf8"));
const compareJson = JSON.parse(fs.readFileSync(comparePath, "utf8"));
const result = {
  readerMeta: firestoreJson.meta,
  compare: {
    compareKey: compareJson.compareKey,
    compareView: compareJson.compareView,
    fieldSemantics: compareJson.fieldSemantics,
    browserCount: compareJson.browserCount,
    firestoreCount: compareJson.firestoreCount,
    matchingCaseCount: (compareJson.matchingCaseNos || []).length,
    browserOnlyCount: (compareJson.browserOnlyCaseNos || []).length,
    firestoreOnlyCount: (compareJson.firestoreOnlyCaseNos || []).length,
    fieldAgreementSummary: {
      region: compareJson.fieldAgreementSummary.region,
      work_date: compareJson.fieldAgreementSummary.work_date,
      complete_date: compareJson.fieldAgreementSummary.complete_date,
    },
  },
};
console.log(JSON.stringify(result));
'@ | node - $firestoreOutputPath $compareOutputPath

  $summary = $summaryJson | ConvertFrom-Json

  $result = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    verifyTarget = "north + in-progress + all-time (subset compare from official browser full baseline)"
    compareView = "browser-list"
    mode = $(if ($hasLiveCreds) { "live-firestore" } else { "snapshot-remap" })
    limitations = $(if ($hasLiveCreds) {
      @()
    } else {
      @(
        "FIREBASE_EMAIL / FIREBASE_PASSWORD not present in current shell session",
        "verification fell back to snapshot-remap mode"
      )
    })
    inputs = [ordered]@{
      browserPath = $browserPath
      browserBaselineLabel = "north + pending + in-progress + all-time"
      browserSubsetFilter = "in-progress"
      historicalSubsetPath = $historicalSubsetPath
      historicalSubsetLabel = "north + in-progress + all-time (9-row subset)"
      firestoreOutputPath = $firestoreOutputPath
      compareOutputPath = $compareOutputPath
      snapshotSourcePath = $(if ($hasLiveCreds) { $null } else { $snapshotSourcePath })
    }
    reader = [ordered]@{
      meta = $summary.readerMeta
    }
    compare = [ordered]@{
      compareKey = $summary.compare.compareKey
      compareView = $summary.compare.compareView
      fieldSemantics = $summary.compare.fieldSemantics
      browserCount = $summary.compare.browserCount
      firestoreCount = $summary.compare.firestoreCount
      matchingCaseCount = $summary.compare.matchingCaseCount
      browserOnlyCount = $summary.compare.browserOnlyCount
      firestoreOnlyCount = $summary.compare.firestoreOnlyCount
      fieldAgreementSummary = [ordered]@{
        region = $summary.compare.fieldAgreementSummary.region
        work_date = $summary.compare.fieldAgreementSummary.work_date
        complete_date = $summary.compare.fieldAgreementSummary.complete_date
      }
    }
  }

  $result | ConvertTo-Json -Depth 10 | Set-Content -Path $verifyOutputPath -Encoding UTF8
  Get-Content -Path $verifyOutputPath -Raw | Out-Host
}
finally {
  foreach ($key in @(
    'FIRESTORE_TARGET_TERRITORY',
    'FIRESTORE_REPAIR_STATUS',
    'SOURCE_JSON_PATH',
    'BROWSER_PATH',
    'FIRESTORE_PATH',
    'OUTPUT_PATH',
    'COMPARE_REPAIR_STATUS'
  )) {
    Remove-Item -Path ("Env:{0}" -f $key) -ErrorAction SilentlyContinue
  }
}
