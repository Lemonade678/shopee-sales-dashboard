import type { SalesRecord } from "./types";

/**
 * Maps a Shopee Seller Center order export (CSV or Excel) into sales rows.
 *
 * Shopee exports vary by locale and template, so instead of hard-coding column
 * positions we match each field against a list of known header aliases
 * (English + Thai). Add new aliases here if your export uses different labels.
 */

type Row = Record<string, unknown>;

const ALIASES: Record<string, string[]> = {
  order_id: ["order id", "order sn", "เลขที่คำสั่งซื้อ", "หมายเลขคำสั่งซื้อ"],
  order_status: ["order status", "สถานะการสั่งซื้อ", "สถานะ"],
  order_date: [
    "order creation date",
    "order paid time",
    "creation date",
    "order time",
    "วันที่ทำการสั่งซื้อ",
    "เวลาที่ทำการสั่งซื้อ",
    "วันเวลาที่ชำระเงิน",
  ],
  sku: [
    "sku reference no.",
    "sku reference no",
    "parent sku reference no.",
    "sku",
    "เลขอ้างอิง sku",
    "เลขอ้างอิง sku (parent sku)",
  ],
  product_name: ["product name", "ชื่อสินค้า"],
  category: ["product category", "category", "หมวดหมู่", "หมวดหมู่สินค้า"],
  variation: ["variation name", "variation", "ชื่อตัวเลือกสินค้า", "ตัวเลือกสินค้า"],
  quantity: ["quantity", "จำนวน"],
  unit_price: [
    "deal price",
    "original price",
    "ราคาขาย",
    "ราคาตั้งต้น",
    "ราคาต่อชิ้น",
  ],
  discount: ["seller discount", "product discount", "ส่วนลดจากผู้ขาย", "ส่วนลด"],
  subtotal: ["product subtotal", "order amount", "ยอดรวมสินค้าย่อย", "ยอดรวม"],
  buyer: ["username (buyer)", "buyer username", "username", "ชื่อผู้ใช้ (ผู้ซื้อ)", "ผู้ซื้อ"],
  province: ["province", "จังหวัด"],
};

function normalise(header: string): string {
  return header.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Build a lookup from our canonical field -> the actual header in this file. */
function buildHeaderMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const normalisedHeaders = headers.map((h) => ({ raw: h, norm: normalise(h) }));

  for (const [field, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      const hit = normalisedHeaders.find((h) => h.norm === alias);
      if (hit) {
        map[field] = hit.raw;
        break;
      }
    }
  }
  return map;
}

function num(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;
  // strip currency symbols, thousands separators
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function parseDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  // Excel serial date (SheetJS may hand back a Date already; papaparse gives string)
  if (value instanceof Date) return value.toISOString();
  const s = String(value).trim();
  // Shopee uses "YYYY-MM-DD HH:mm" or "YYYY-MM-DD HH:mm:ss"
  const iso = s.includes(" ") ? s.replace(" ", "T") : s;
  const d = new Date(iso);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

export interface ParseResult {
  records: Omit<SalesRecord, "shop_id">[];
  skipped: number;
  matchedColumns: string[];
  missingRequired: string[];
}

export function parseShopeeRows(rows: Row[]): ParseResult {
  if (rows.length === 0) {
    return { records: [], skipped: 0, matchedColumns: [], missingRequired: ["file is empty"] };
  }

  const headers = Object.keys(rows[0]);
  const hmap = buildHeaderMap(headers);

  const required = ["order_id", "order_date"];
  const missingRequired = required.filter((f) => !hmap[f]);
  if (missingRequired.length > 0) {
    return { records: [], skipped: rows.length, matchedColumns: Object.keys(hmap), missingRequired };
  }

  const records: Omit<SalesRecord, "shop_id">[] = [];
  let skipped = 0;

  for (const row of rows) {
    const orderId = str(row[hmap.order_id]);
    const orderDate = parseDate(row[hmap.order_date]);
    if (!orderId || !orderDate) {
      skipped++;
      continue;
    }

    const quantity = Math.max(1, Math.round(num(row[hmap.quantity]) || 1));
    const unitPrice = num(row[hmap.unit_price]);
    const discount = num(row[hmap.discount]);

    // Prefer the export's own subtotal; otherwise derive it.
    const subtotal = hmap.subtotal ? num(row[hmap.subtotal]) : 0;
    const revenue = subtotal > 0 ? subtotal : Math.max(0, unitPrice * quantity - discount);

    records.push({
      order_id: orderId,
      order_status: hmap.order_status ? str(row[hmap.order_status]) : null,
      order_date: orderDate,
      sku: hmap.sku ? str(row[hmap.sku]) : null,
      product_name: hmap.product_name ? str(row[hmap.product_name]) : null,
      category: hmap.category ? str(row[hmap.category]) : null,
      variation: hmap.variation ? str(row[hmap.variation]) : null,
      quantity,
      unit_price: unitPrice,
      discount,
      revenue,
      buyer: hmap.buyer ? str(row[hmap.buyer]) : null,
      province: hmap.province ? str(row[hmap.province]) : null,
    });
  }

  return { records, skipped, matchedColumns: Object.keys(hmap), missingRequired: [] };
}
