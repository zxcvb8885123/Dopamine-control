# Dopamine Detox — Design System

## 色彩 Tokens

```css
:root {
  /* Background */
  --bg:          #0f1116;   /* 全頁底色 */
  --bg-soft:     #131722;   /* 次層背景 */
  --surface:     #171b25;   /* 卡片 / 區塊 */
  --surface-2:   #1a2030;   /* 卡片內層 */
  --surface-3:   #1e2540;   /* 深色強調區塊 */

  /* Border */
  --border:      #2b3245;
  --border-soft: #222738;

  /* Text */
  --text:        #e8edf9;   /* 主文字 */
  --text-muted:  #96a2bd;   /* 次要文字 */
  --text-dim:    #5a6580;   /* 說明 / placeholder */

  /* Accent */
  --accent:      #3a8cff;
  --accent-soft: #84b6ff;
  --accent-dim:  rgba(58, 140, 255, 0.16);

  /* Semantic */
  --danger:      #e57373;
  --success:     #9ee6b4;
  --warning:     #f5c96a;

  /* Shadow */
  --shadow-card: 0 18px 40px rgba(0, 0, 0, 0.42);
}
```

---

## 字體

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

| 用途 | size | weight | color |
|---|---|---|---|
| 頁面標題 | 19px | 700 | `--text` |
| 區塊標題 | 14px | 700 | `--text` |
| section label | 11px | 600 | `--text-muted`，uppercase，letter-spacing 0.8px |
| 內文 / 輸入 | 13px | 400 | `--text` |
| 次要說明 | 12px | 400 | `--text-muted` |
| 標註 / badge | 11px | 700 | 依情境 |

---

## 間距

使用 4px 倍數系統：`4 / 8 / 12 / 16 / 20 / 24 / 32 / 48`

---

## 圓角

| 元件 | radius |
|---|---|
| 頁面卡片 | 18px |
| 輸入框 / 按鈕 | 9–10px |
| 小標籤 / badge | 6px |
| Pill（時間、計數） | 999px |

---

## 元件規格

### 輸入框
```css
background: var(--surface-2);
border: 1px solid var(--border);
border-radius: 9px;
padding: 9px 10px;
font-size: 13px;
color: var(--text);
outline: none;
transition: border-color 150ms, box-shadow 150ms;

/* focus */
border-color: var(--accent);
box-shadow: 0 0 0 2px var(--accent-dim);
```

### 主要按鈕（Primary）
```css
background: linear-gradient(180deg, #4b95ff 0%, var(--accent) 100%);
color: #fff;
border: 1px solid var(--accent);
border-radius: 10px;
padding: 10px;
font-size: 13px;
font-weight: 600;
```

### 次要按鈕（Secondary）
```css
background: var(--surface);
color: var(--accent-soft);
border: 1px solid var(--border);
border-radius: 10px;
```

### 危險按鈕 / 標籤
```css
border-color: var(--danger);
color: var(--danger);
```

### 卡片
```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: 18px;
box-shadow: var(--shadow-card);
```

### Toggle（iOS 樣式）
- 尺寸：36×20px，圓鈕 14×14px
- 關閉：`#333`；開啟：`var(--accent)`

---

## 三頁一致性規範

### popup.html
- 寬 340px，最大高 580px
- header sticky，`border-bottom: 1px solid var(--border-soft)`
- section-title：11px uppercase

### blocked.html
- 全螢幕置中，單張卡片（max-width 420px）
- 卡片頂部藍色漸層條（height 3px）與 report.html 一致
- icon 改用 SVG，禁止使用 emoji

### report.html
- max-width 430px，置中
- 卡片頂部藍色漸層條
- UI 文字統一改為中文：
  - "Report" → "使用報表"
  - "Daily / Weekly / Monthly" → "今日 / 本週 / 本月"
  - "Loading..." → "載入中..."
  - "No usage data for this period." → "這段期間無使用紀錄"
  - "Total / Avg/day" → "總時長 / 日均"
  - "Top 1" → "最高"

---

---

## 動畫標準

| 情境 | duration | easing |
|---|---|---|
| 顏色 / border 切換 | 150ms | ease |
| 元件進場（fadeIn） | 240ms | ease-out |
| hover 位移（translateY） | 120–150ms | ease |

支援 `prefers-reduced-motion`：動畫全部設為 `none`。
