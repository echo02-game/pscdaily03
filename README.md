# 普通話每日練習打卡 — 老師設定手冊

一次性設定約 15–20 分鐘。設定好之後，學生每天在手機上按「提交」，記錄就會自動出現在你 Notion 的「每日朗讀打卡記錄」資料庫。

---

## 系統架構（一頁看懂）

```
學生手機（PWA） ──POST JSON──▶ Make.com（免費中轉） ──▶ 你的 Notion 資料庫
        ▲                                                      │
        └──────────── 你在 Notion 看到打卡記錄 ◀────────────────┘
```

- **PWA**：靜態網頁，放在 GitHub Pages，學生用瀏覽器打開後可「加入主畫面」變成 App。
- **Make.com**：免費中轉服務，把學生送來的 JSON 寫入你的 Notion。免費額度 1000 次/月，20 人班 × 每週 4 天 ≈ 320 次/月，綽綽有餘。
- **Notion**：你的資料庫「每日朗讀打卡記錄」已建立完成，欄位齊備。

---

## 步驟 A：把 PWA 放上 GitHub Pages（約 5 分鐘）

1. 到 <https://github.com/echo02-game>，右上角「+ → New repository」。
2. Repository name 建議 **`pscdaily`**（可自訂，日後網址會用到）。設為 **Public**，勾選「Add a README file」，按 Create。
3. 進入新 repo，點「Add file → Upload files」，把 zip 內所有檔案（`index.html`、`styles.css`、`app.js`、`data.js`、`manifest.webmanifest`、`service-worker.js`、`icon-192.png`、`icon-512.png`、`icon-512-maskable.png`）一次拖進去，按 Commit changes。
4. 點該 repo 的 **Settings → Pages**：Source 選 `Deploy from a branch`，Branch 選 `main` / `(root)`，Save。
5. 等 1–2 分鐘，同一頁面頂部會出現網址：**`https://echo02-game.github.io/pscdaily/`**。
6. 用手機瀏覽器打開這條網址測試能否進入。

---

## 步驟 B：建立 Make.com 中轉（約 10 分鐘）

### B1. 註冊帳號
- 前往 <https://www.make.com>，用 Google 或 email 註冊免費帳號（Free plan 已足夠）。

### B2. 建立 Scenario
1. 左邊選單 **Scenarios → Create a new scenario**。
2. 中央畫面按大圓圈「+」，搜尋並選 **Webhooks → Custom webhook**。
3. Add → 隨便命名（例如「PSC Daily Check-in」）→ Save。
4. Make 會顯示一條 URL，例如：
   `https://hook.eu2.make.com/abc123xyz...`
   **複製這條 URL**，稍後要填進 PWA（步驟 C）。
5. Make 現在會提示「Waiting for data」——先不要關這個畫面。

### B3. 先讓 Make 認識資料格式（餵一筆測試）
在手機打開你的 PWA 網址，填一次假打卡並按提交（或使用 curl / Postman POST 以下 JSON 到剛剛那條 URL）：
```json
{
  "學生姓名":"測試",
  "日期":"2026-09-09",
  "週次":"第1週",
  "星期":"週二",
  "朗讀篇目":"第 40 篇",
  "朗讀完成":true,
  "難點字詞卡":true,
  "自學專項完成":true,
  "弱項練習完成":false,
  "選做練習":"iOS「普通話考試」App 真題練習",
  "備註":"測試"
}
```
Make 收到後會顯示「Successfully determined」。

### B4. 加入 Notion 寫入動作
1. 在 Webhook 圓圈右邊按 **+** 增加下一步，搜尋並選 **Notion → Create a Database Item**。
2. Connection → **Add**，跟指示登入 Notion 並授權 Make.com 存取你的 workspace。
   - 授權時，記得把「每日朗讀打卡記錄」資料庫（以及它所在的 teamspace）勾選給 Make.com。
3. Database ID → 選 **每日朗讀打卡記錄**。
4. Make 會自動列出所有欄位。逐個對應（點欄位輸入框右側，從左欄選對應的 webhook 值）：

   | Notion 欄位 | 對應 Webhook 值 |
   |---|---|
   | 學生姓名（title） | `1. 學生姓名` |
   | 日期（date） | `1. 日期` |
   | 週次（select） | `1. 週次` |
   | 星期（select） | `1. 星期` |
   | 朗讀篇目（text） | `1. 朗讀篇目` |
   | 朗讀完成（checkbox） | `1. 朗讀完成` |
   | 難點字詞卡（checkbox） | `1. 難點字詞卡` |
   | 自學專項完成（checkbox） | `1. 自學專項完成` |
   | 弱項練習完成（checkbox） | `1. 弱項練習完成` |
   | 選做練習（text） | `1. 選做練習` |
   | 備註（text） | `1. 備註` |

   > **朗讀準確率、自學準確率、弱項準確率**：這三欄由老師評改後在 Notion 直接填寫，不由 PWA 送出，所以不用在 Make 這裡對應。
   > **弱項練習派發紀錄** 是另一個 Notion 資料庫，用來手動記錄老師派發歷史，跟 Make.com 沒有關係。

5. 按 OK 儲存這個模組。
6. 畫面左下角把 **Scheduling** 開關打開，並選 **Immediately**（一收到即執行）；按 **Save**。
7. 右下角開關切換到 **ON**。完成。

### B5. 測一次
- 手機打開 PWA，隨便填一筆真打卡並提交。
- 幾秒後打開 Notion 資料庫「每日朗讀打卡記錄」，應該看到新增一列。✅

---

## 步驟 C：把 Webhook URL 交給學生

你有兩種做法：

**做法 1（推薦，學生零操作）**：把 URL 直接寫進 PWA。
- 打開 `data.js`，把最上面：
  ```js
  WEBHOOK_URL: ""
  ```
  改成：
  ```js
  WEBHOOK_URL: "https://hook.eu2.make.com/abc123xyz..."
  ```
- 存檔，重新上傳到 GitHub（覆蓋舊 `data.js`）。學生下次打開會自動載入新版。

**做法 2**：交給學生自己填。
- 把 URL 用 WhatsApp 傳給學生，讓他們在 PWA「設定」頁貼上。之後不用再理。

---

## 步驟 D：學生第一次使用

發給每位學生兩件事：
1. **PWA 網址**：`https://echo02-game.github.io/pscdaily/`
2. **簡短安裝說明**（可直接複製給學生）：
   > 開學打卡工具：
   > ① 用手機瀏覽器打開 https://echo02-game.github.io/pscdaily/
   > ② iPhone（Safari）：按下方「分享 ⬆」→「加入主畫面」；
   >    Android（Chrome）：按右上「⋮」→「安裝應用程式」/「加到主畫面」。
   > ③ 打開新出現的「普通話打卡」圖示，輸入姓名即可開始。

---

## 步驟 E：日常查看

- 打開 Notion 資料庫「每日朗讀打卡記錄」：
  - **按學生檢視**：一眼看到每位學生的所有打卡記錄。
  - **按週次檢視**：以看板呈現本週進度。
  - **日曆檢視**：以日曆呈現全體活動熱度。
- 想追蹤誰未打卡：在「按學生檢視」加篩選 `日期 = 今天` 即可。

---

## 常見問題

**Q. 學生沒有網路時打卡會消失嗎？**
不會。PWA 會把打卡暫存在手機本地，恢復網絡後會自動補送到 Make.com。

**Q. 學生手機需要甚麼權限？**
只需要「使用瀏覽器」——不會要求相機、麥克風、通知、位置。所有輸入只在按「提交」時才會送出。

**Q. 免費 Make.com 額度用完怎麼辦？**
- 一次呼叫 = 一次寫入。20 人班每人每週 4 次 = 80 次/週，一個月 ≈ 320 次，遠低於 1000 次上限。
- 如果一個月接近上限，可在 Make 的 Scheduling 改為「每 15 分鐘打包一次」以減少呼叫（但即時性會下降）。

**Q. 想改課程開始日期／增加班別怎麼辦？**
- 開始日期：學生可自己在 PWA「設定」改；老師層面在 `data.js` 改 `COURSE_START`。
- 多班別：目前所有學生的資料進同一個 Notion 資料庫，用「按學生檢視」自動分組即可分辨。

**Q. 學生打錯後可以更新嗎？**
可以，同一天再提交一次，Notion 會��出一列（同姓名、同日期）。你若想「同日只保留最新」，可在 Notion 用「按學生 + 日期」分組後手動整理，或請學生盡量一天提交一次。

---

## 檔案清單

- `index.html`, `styles.css`, `app.js` — 介面與邏��
- `data.js` — 課程資料（每週篇目、課堂內容、選做項目）＋ Webhook URL
- `manifest.webmanifest`, `service-worker.js` — PWA 離線與安裝支援
- `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` — 應用圖示

如需調整介面文字、增減欄位、或改成不同課程，直接修改 `data.js`（改資料）或 `app.js`（改邏輯）即可，無需重建 Notion 或 Make.com。
