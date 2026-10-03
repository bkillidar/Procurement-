import { addDays } from "@/lib/dates";

// Demo data for a realistic DC renovation. Every date is relative to "today", so the
// risks always look realistic whenever the demo is loaded.

export const DEMO_PROJECT_PREFIX = "DEMO — ";
export const DEMO_VENDOR_SUFFIX = " (demo)";

export interface DemoItem {
  vendor: string; // vendor key
  category: string;
  description: string;
  quantity: number;
  unit: string;
  status: string;
  required: number; // days from today
  lead: number;
  ordered?: number;
  confirmed?: number;
  expected?: number;
  delivered?: number;
  received?: number;
  /** What the rules should say about this item (checked by tests). */
  expectRisk: "none" | "medium" | "high" | "critical";
}

export interface DemoVendor {
  key: string;
  name: string;
  category: string;
  lead: number;
  phone: string;
}

export const DEMO_VENDORS: DemoVendor[] = [
  { key: "windows", name: "Northeast Window & Door", category: "Windows", lead: 28, phone: "202-555-0141" },
  { key: "lumber", name: "Capital Lumber", category: "Lumber & roofing", lead: 7, phone: "202-555-0142" },
  { key: "cabinets", name: "Metro Cabinetry", category: "Cabinets", lead: 56, phone: "301-555-0143" },
  { key: "appliances", name: "Atlantic Appliance", category: "Appliances", lead: 14, phone: "703-555-0144" },
];

export const DEMO_ITEMS: DemoItem[] = [
  { vendor: "windows", category: "Windows", description: "Double-hung vinyl windows", quantity: 32, unit: "ea", status: "ready_to_order", required: 18, lead: 28, expectRisk: "critical" },
  { vendor: "lumber", category: "Framing lumber", description: "Framing lumber package", quantity: 4200, unit: "bf", status: "awaiting_vendor_confirmation", required: 9, lead: 7, ordered: -5, expectRisk: "medium" },
  { vendor: "lumber", category: "Asphalt shingles", description: "Architectural asphalt shingles", quantity: 38, unit: "sq", status: "confirmed", required: 6, lead: 10, ordered: -14, confirmed: -8, expected: -2, expectRisk: "high" },
  { vendor: "cabinets", category: "Kitchen cabinets", description: "Kitchen cabinet package", quantity: 1, unit: "set", status: "quoting", required: 60, lead: 56, expectRisk: "medium" },
  { vendor: "appliances", category: "Appliances", description: "Kitchen appliance package", quantity: 5, unit: "ea", status: "shipped", required: 14, lead: 14, ordered: -10, confirmed: -9, expected: 1, expectRisk: "none" },
  { vendor: "lumber", category: "Insulation", description: "Batt insulation, walls and attic", quantity: 120, unit: "bag", status: "delivered", required: -3, lead: 7, ordered: -20, confirmed: -19, expected: -12, delivered: -12, received: 120, expectRisk: "none" },
  { vendor: "lumber", category: "Drywall", description: "1/2\" drywall sheets", quantity: 300, unit: "sheet", status: "partially_delivered", required: 4, lead: 5, ordered: -12, confirmed: -11, expected: -3, received: 260, expectRisk: "high" },
];

export function buildDemoProject(today: string) {
  return {
    name: `${DEMO_PROJECT_PREFIX}1420 Euclid St NW`,
    address: "1420 Euclid St NW, Washington, DC 20009",
    jurisdiction: "DC",
    project_type: "renovation",
    scope: "Full gut renovation of a 3-bed rowhouse: new kitchen, two baths, windows, roof, rear addition.",
    acquisition_details: "Closed with hard-money lender; 12-month term.",
    start_date: addDays(today, -100),
    target_completion_date: addDays(today, 170),
    notes: "Sample project created by “Load demo project”. Delete it from the bottom of this page when you are done.",
  };
}

export const date = (today: string, offset: number | undefined) => (offset === undefined ? null : addDays(today, offset));
