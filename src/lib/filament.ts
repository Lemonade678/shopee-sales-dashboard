/**
 * Parse filament material & colour out of a product name / variation string,
 * then aggregate sales by each. Tailored to R3D-style naming like
 * "R3D PLA+ 1kg (Black)" or a variation of "Matte Grey".
 *
 * Pure functions — safe to use on the server or the client.
 */

export interface ProductRow {
  product_name: string | null;
  variation: string | null;
  revenue: number;
  units: number;
}

export interface Segment {
  key: string;
  label: string;
  revenue: number;
  units: number;
  hex?: string; // colour swatch (colours only)
}

// Order matters: more specific tokens first (Matte/Silk/PLA+ before plain PLA).
const MATERIALS: { test: RegExp; label: string }[] = [
  { test: /pla\s*matte|matte\s*pla|\bmatte\b/i, label: "PLA Matte" },
  { test: /\bsilk\b/i, label: "Silk PLA" },
  { test: /\bpetg\b/i, label: "PETG" },
  { test: /\bpla\s*\+|\bpla\+/i, label: "PLA+" },
  { test: /\bpla\b/i, label: "PLA" },
  { test: /\babs\b/i, label: "ABS" },
  { test: /\btpu\b/i, label: "TPU" },
];

const OTHER_MATERIAL = "3D Parts / Other";

// Colour keyword -> swatch hex. Order matters (multi-word before single).
const COLOURS: { test: RegExp; label: string; hex: string }[] = [
  { test: /transparent|clear|natural/i, label: "Clear", hex: "#e2e8f0" },
  { test: /\bblack\b|ดำ/i, label: "Black", hex: "#1e293b" },
  { test: /\bwhite\b|ขาว/i, label: "White", hex: "#f1f5f9" },
  { test: /\bgrey\b|\bgray\b|เทา/i, label: "Grey", hex: "#94a3b8" },
  { test: /\bsilver\b|เงิน/i, label: "Silver", hex: "#cbd5e1" },
  { test: /\bgold\b|ทอง/i, label: "Gold", hex: "#d4af37" },
  { test: /\bred\b|แดง/i, label: "Red", hex: "#ef4444" },
  { test: /\borange\b|ส้ม/i, label: "Orange", hex: "#f97316" },
  { test: /\byellow\b|เหลือง/i, label: "Yellow", hex: "#eab308" },
  { test: /\bgreen\b|เขียว/i, label: "Green", hex: "#22c55e" },
  { test: /\bblue\b|น้ำเงิน|ฟ้า/i, label: "Blue", hex: "#3b82f6" },
  { test: /\bpurple\b|ม่วง/i, label: "Purple", hex: "#a855f7" },
  { test: /\bpink\b|ชมพู/i, label: "Pink", hex: "#ec4899" },
  { test: /\bbrown\b|น้ำตาล/i, label: "Brown", hex: "#92400e" },
];

export function parseMaterial(name: string | null, variation: string | null): string {
  const hay = `${name ?? ""} ${variation ?? ""}`;
  for (const m of MATERIALS) if (m.test.test(hay)) return m.label;
  return OTHER_MATERIAL;
}

export function parseColour(
  name: string | null,
  variation: string | null
): { label: string; hex: string } | null {
  // Prefer the variation field, then any text inside parentheses in the name.
  const paren = name?.match(/\(([^)]+)\)/)?.[1] ?? "";
  const hay = `${variation ?? ""} ${paren} ${name ?? ""}`;
  for (const c of COLOURS) if (c.test.test(hay)) return { label: c.label, hex: c.hex };
  return null;
}

function toSorted(map: Map<string, Segment>): Segment[] {
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

export interface FilamentBreakdown {
  byMaterial: Segment[];
  byColour: Segment[];
}

export function aggregateFilament(rows: ProductRow[]): FilamentBreakdown {
  const materials = new Map<string, Segment>();
  const colours = new Map<string, Segment>();

  for (const r of rows) {
    const mat = parseMaterial(r.product_name, r.variation);
    const m = materials.get(mat) ?? { key: mat, label: mat, revenue: 0, units: 0 };
    m.revenue += r.revenue;
    m.units += r.units;
    materials.set(mat, m);

    const col = parseColour(r.product_name, r.variation);
    if (col) {
      const c = colours.get(col.label) ?? {
        key: col.label,
        label: col.label,
        hex: col.hex,
        revenue: 0,
        units: 0,
      };
      c.revenue += r.revenue;
      c.units += r.units;
      colours.set(col.label, c);
    }
  }

  return { byMaterial: toSorted(materials), byColour: toSorted(colours) };
}
