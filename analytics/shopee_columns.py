"""Shopee export column mapping (English + Thai), mirrored from the web app's
`src/lib/shopee.ts` so the Python pipeline and the dashboard agree on fields."""

from __future__ import annotations

ALIASES: dict[str, list[str]] = {
    "order_id": ["order id", "order sn", "เลขที่คำสั่งซื้อ", "หมายเลขคำสั่งซื้อ"],
    "order_status": ["order status", "สถานะการสั่งซื้อ", "สถานะ"],
    "order_date": [
        "order creation date",
        "order paid time",
        "creation date",
        "order time",
        "วันที่ทำการสั่งซื้อ",
        "เวลาที่ทำการสั่งซื้อ",
        "วันเวลาที่ชำระเงิน",
    ],
    "sku": [
        "sku reference no.",
        "sku reference no",
        "parent sku reference no.",
        "sku",
        "เลขอ้างอิง sku",
        "เลขอ้างอิง sku (parent sku)",
    ],
    "product_name": ["product name", "ชื่อสินค้า"],
    "category": ["product category", "category", "หมวดหมู่", "หมวดหมู่สินค้า"],
    "variation": ["variation name", "variation", "ชื่อตัวเลือกสินค้า", "ตัวเลือกสินค้า"],
    "quantity": ["quantity", "จำนวน"],
    "unit_price": ["deal price", "original price", "ราคาขาย", "ราคาตั้งต้น", "ราคาต่อชิ้น"],
    "discount": ["seller discount", "product discount", "ส่วนลดจากผู้ขาย", "ส่วนลด"],
    "subtotal": ["product subtotal", "order amount", "ยอดรวมสินค้าย่อย", "ยอดรวม"],
    "buyer": ["username (buyer)", "buyer username", "username", "ชื่อผู้ใช้ (ผู้ซื้อ)", "ผู้ซื้อ"],
    "province": ["province", "จังหวัด"],
}

# Order states that should not count toward revenue.
EXCLUDED_STATUSES = {"cancelled", "unpaid"}


def normalise(header: str) -> str:
    return " ".join(str(header).lower().split()).strip()


def build_header_map(headers: list[str]) -> dict[str, str]:
    """Map canonical field -> the real column name present in this file."""
    norm = [(h, normalise(h)) for h in headers]
    mapping: dict[str, str] = {}
    for field, aliases in ALIASES.items():
        for alias in aliases:
            hit = next((raw for raw, n in norm if n == alias), None)
            if hit is not None:
                mapping[field] = hit
                break
    return mapping
