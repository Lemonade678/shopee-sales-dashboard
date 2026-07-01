# Dashboard roadmap — แมวกินเส้น

Prioritised ideas for evolving the dashboard, grounded in Shopee-seller and
e-commerce analytics best practice and tailored to a filament (R3D) + 3D-parts
store. Ordered by **value ÷ effort** given the current schema.

Legend — Data need: 🟢 already in the order export · 🟡 small schema addition ·
🔴 needs Shopee traffic/Open-API or a cost sheet.

---

## Tier 1 — quick wins (days, high value)

### 1. Filament type & colour breakdown 🟢
Split revenue/units by **material** (PLA+ / PETG / Silk / TPU) and **colour**,
parsed from the product name / `variation` field. Answers "which colours do I
restock first?". *This is the single most useful view for a filament shop.*

### 2. Kilograms sold & revenue-per-kg 🟡
Add a `weight_kg` per SKU (0.5 / 1.0). Then show **kg sold per month** and
**฿/kg** trend — the real unit of a filament business, not just baht.

### 3. Province / geo view 🟢
You already capture `province`. A top-provinces bar or Thailand heatmap shows
where demand concentrates → informs shipping and regional promos.

### 4. Campaign-date tagging 🟢
Flag double-date campaigns (6.6, 7.7, 8.8, 9.9, 11.11, 12.12) on the time-series
and compare campaign vs normal-day revenue lift. Shopee sales are spiky on these
dates — the current forecast already models it; make it explicit.

### 5. Custom date range + period compare 🟢
Add an explicit "compare to previous period / same period last year" toggle
(the KPI deltas already compute this — expose a full comparison view).

---

## Tier 2 — customer intelligence (1–2 weeks, high retention value)

### 6. Repeat Buyer Rate (RBR) + RFM segmentation 🟢
You have `buyer` on every line. Compute **Recency / Frequency / Monetary** and
bucket customers into **Champions / Loyal / At-Risk / Hibernating**.
> Research signal: Shopee stores with **RBR > 32%** saw **3.1× higher margins**
> than acquisition-only peers; top sellers hold a 30-day repeat rate ≥ 18%.

### 7. Cohort retention 🟢
Group buyers by first-purchase month and chart how many return in later months —
the clearest picture of whether the shop is building a loyal base.

### 8. Customer LTV & "at-risk champions" list 🟢
Rank customers by lifetime value and surface high-value buyers who haven't
ordered recently → a ready-made re-engagement / chat-follow-up list.

---

## Tier 3 — inventory & operations (needs a small stock table)

### 9. Stock levels + reorder-point alerts 🟡
Add an `inventory` table (spools on hand per SKU). Combine with sales velocity to
show **days-of-cover** and raise a **low-stock alert** before a stockout —
standard practice in filament-management tools (Filametrics, Craftybase, etc.).

### 10. Restock forecast 🟢→🟡
Reuse the existing forecast per SKU to predict the date each colour runs out —
"R3D Silk Gold: ~9 days of stock left at current pace."

### 11. Gross margin / profit 🔴
Add a cost sheet (cost per SKU / per gram) → show **gross profit** and
**margin %** alongside revenue. Turns a revenue dashboard into a profit one.

---

## Tier 4 — advanced (needs Shopee traffic data or Open API)

### 12. Conversion funnel (CvR) 🔴
Visitors → product clicks → orders. Needs Shopee's traffic export or the Open
API. Benchmarks: home & living ~3.1%, beauty ~4.8% click-to-conversion.

### 13. Live sync via Shopee Open API 🔴
Replace manual CSV uploads with scheduled pulls (`partner_id` + shop auth),
landing straight in `sales_records`.

### 14. Multi-channel 🟡
Extend the importer to Lazada / TikTok Shop exports (the `platform` column on
`shops` already anticipates this) for a single cross-marketplace view.

---

## Product / delivery polish

- **AI insight summary** — a short auto-written "what changed this week" note
  (revenue anomalies, rising colours, at-risk customers) using Claude.
- **Scheduled digest** — daily/weekly email or LINE summary (a cron job calling
  the aggregation RPCs).
- **PDF / Excel export** of the current view for sharing with the team.
- **Alerts** — revenue drop > X%, stockout risk, refund spike.
- **Dark mode & brand theming** to match R3D.

---

### Suggested next sprint
1 → 2 → 6 (filament breakdown, kg metrics, then RFM/repeat-buyer). These are the
highest-impact and mostly work off data you already import.
