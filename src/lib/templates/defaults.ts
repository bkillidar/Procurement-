import type { Priority, TemplateTaskDef } from "./plan";

// Starter templates. They are copied into the database the first time the app
// runs, so they can be edited later without touching code. Titles that mention
// an agency/utility are starting points — adjust per project.

export const PHASE_NAMES = [
  "Feasibility",
  "Acquisition",
  "Architecture",
  "Engineering",
  "Subcontractor selection",
  "Permitting",
  "Utilities",
  "Procurement",
  "Construction",
  "Punch list",
  "Completion",
] as const;

export interface DefaultTemplate {
  name: string;
  projectType: "renovation" | "new_construction";
  jurisdiction: string | null;
  description: string;
  tasks: TemplateTaskDef[];
}

type T = (
  key: string,
  phase: (typeof PHASE_NAMES)[number],
  title: string,
  offsetDays: number,
  dependsOn?: string[],
  priority?: Priority,
) => TemplateTaskDef;

const t: T = (key, phase, title, offsetDays, dependsOn = [], priority = "medium") => ({
  key,
  phase,
  title,
  offsetDays,
  dependsOn,
  priority,
});

interface Agency {
  permitOffice: string;
  gas: string;
  water: string;
  power: string;
}

function renovationTasks(a: Agency): TemplateTaskDef[] {
  return [
    // Feasibility
    t("feasibility", "Feasibility", "Property feasibility analysis", 0, [], "high"),
    t("offer_price", "Feasibility", "Determine offer price", 5, ["feasibility"], "high"),
    t("proof_of_funds", "Feasibility", "Obtain proof of funds", 5, ["feasibility"]),
    t("lender_talks", "Feasibility", "Lender discussions", 7, ["offer_price"]),
    // Acquisition
    t("submit_offer", "Acquisition", "Submit official property offer", 10, ["offer_price", "proof_of_funds"], "high"),
    t("lender_contract", "Acquisition", "Execute lender contract", 21, ["lender_talks", "submit_offer"]),
    t("contract_executed", "Acquisition", "Acquisition / purchase contract executed", 30, ["submit_offer", "lender_contract"], "high"),
    // Architecture
    t("select_architect", "Architecture", "Select architect / engineer", 35, ["contract_executed"]),
    t("architect_contract", "Architecture", "Execute architect contract", 42, ["select_architect"]),
    t("arch_design", "Architecture", "Architectural design", 70, ["architect_contract"]),
    // Engineering
    t("eng_design", "Engineering", "Engineering design", 85, ["arch_design"]),
    t("plans_final", "Engineering", "Plans and specifications finalized", 100, ["eng_design"], "urgent"),
    // Subcontractors
    t("sub_estimates", "Subcontractor selection", "Obtain subcontractor estimates", 108, ["plans_final"]),
    t("sub_compare", "Subcontractor selection", "Compare estimates", 118, ["sub_estimates"]),
    t("sub_select", "Subcontractor selection", "Select subcontractors", 122, ["sub_compare"], "high"),
    t("sub_contracts", "Subcontractor selection", "Execute subcontractor contracts", 130, ["sub_select"], "high"),
    // Permitting
    t("permit_prep", "Permitting", "Prepare permit application", 104, ["plans_final"]),
    t("permit_submit", "Permitting", `Submit building permit application (${a.permitOffice})`, 108, ["permit_prep"], "high"),
    t("permit_approved", "Permitting", "Building permit approved", 140, ["permit_submit"], "urgent"),
    // Utilities
    t("gas_capoff", "Utilities", `Gas cap-off (${a.gas})`, 112, ["contract_executed"]),
    t("water_capoff", "Utilities", `Water cap-off (${a.water})`, 112, ["contract_executed"]),
    t("temp_power", "Utilities", `Temporary power (${a.power})`, 142, ["permit_approved"]),
    // Procurement
    t("quantities", "Procurement", "Receive material quantities from architect / engineer", 106, ["plans_final"], "high"),
    t("proc_list", "Procurement", "Build procurement list and required-on-site dates", 110, ["quantities"], "high"),
    t("long_lead", "Procurement", "Place long-lead orders (windows, cabinets, appliances)", 114, ["proc_list"], "urgent"),
    // Construction
    t("demo", "Construction", "Demolition", 145, ["permit_approved", "sub_contracts", "gas_capoff", "water_capoff"]),
    t("rough_in", "Construction", "Framing and rough-in (MEP)", 165, ["demo", "temp_power"]),
    t("rough_inspect", "Construction", "Rough-in inspections passed", 180, ["rough_in"], "high"),
    t("insulation_drywall", "Construction", "Insulation and drywall", 195, ["rough_inspect"]),
    t("finishes", "Construction", "Interior finishes (flooring, cabinets, paint)", 225, ["insulation_drywall"]),
    t("final_trim", "Construction", "Fixtures, appliances and final trim", 245, ["finishes"]),
    // Punch list
    t("walkthrough", "Punch list", "Owner walkthrough", 250, ["final_trim"], "high"),
    t("punch_list", "Punch list", "Create punch list", 251, ["walkthrough"], "high"),
    t("punch_done", "Punch list", "Complete punch list items", 262, ["punch_list"], "high"),
    // Completion
    t("final_inspect", "Completion", "Final inspection / sign-off", 266, ["punch_done"], "high"),
    t("handover", "Completion", "Prepare project for handover", 270, ["final_inspect"]),
  ];
}

function newConstructionTasks(a: Agency): TemplateTaskDef[] {
  return [
    t("feasibility", "Feasibility", "Lot feasibility analysis (zoning, utilities, grading)", 0, [], "high"),
    t("offer_price", "Feasibility", "Determine offer price", 5, ["feasibility"], "high"),
    t("proof_of_funds", "Feasibility", "Obtain proof of funds", 5, ["feasibility"]),
    t("lender_talks", "Feasibility", "Lender discussions (construction loan)", 7, ["offer_price"]),
    t("submit_offer", "Acquisition", "Submit official offer on lot", 10, ["offer_price", "proof_of_funds"], "high"),
    t("lender_contract", "Acquisition", "Execute lender contract", 25, ["lender_talks", "submit_offer"]),
    t("contract_executed", "Acquisition", "Lot purchase closed", 40, ["submit_offer", "lender_contract"], "high"),
    t("select_architect", "Architecture", "Select architect", 45, ["contract_executed"]),
    t("architect_contract", "Architecture", "Execute architect contract", 52, ["select_architect"]),
    t("arch_design", "Architecture", "Architectural design", 100, ["architect_contract"]),
    t("eng_design", "Engineering", "Structural / civil / MEP engineering", 130, ["arch_design"]),
    t("plans_final", "Engineering", "Plans and specifications finalized", 145, ["eng_design"], "urgent"),
    t("sub_estimates", "Subcontractor selection", "Obtain subcontractor estimates", 152, ["plans_final"]),
    t("sub_compare", "Subcontractor selection", "Compare estimates", 162, ["sub_estimates"]),
    t("sub_select", "Subcontractor selection", "Select subcontractors", 166, ["sub_compare"], "high"),
    t("sub_contracts", "Subcontractor selection", "Execute subcontractor contracts", 175, ["sub_select"], "high"),
    t("permit_prep", "Permitting", "Prepare permit application and site plan", 148, ["plans_final"]),
    t("permit_submit", "Permitting", `Submit building permit application (${a.permitOffice})`, 152, ["permit_prep"], "high"),
    t("permit_approved", "Permitting", "Building permit approved", 200, ["permit_submit"], "urgent"),
    t("water_sewer", "Utilities", `Water / sewer tap and connection (${a.water})`, 205, ["permit_approved"]),
    t("gas_service", "Utilities", `Gas service (${a.gas})`, 205, ["permit_approved"]),
    t("temp_power", "Utilities", `Temporary power (${a.power})`, 205, ["permit_approved"]),
    t("quantities", "Procurement", "Receive material quantities from architect / engineer", 150, ["plans_final"], "high"),
    t("proc_list", "Procurement", "Build procurement list and required-on-site dates", 155, ["quantities"], "high"),
    t("long_lead", "Procurement", "Place long-lead orders (windows, trusses, cabinets)", 160, ["proc_list"], "urgent"),
    t("site_work", "Construction", "Site work and foundation", 215, ["permit_approved", "sub_contracts", "temp_power"]),
    t("framing", "Construction", "Framing, sheathing and roofing", 255, ["site_work"]),
    t("rough_in", "Construction", "Rough-in (MEP) and inspections", 285, ["framing", "water_sewer", "gas_service"], "high"),
    t("insulation_drywall", "Construction", "Insulation and drywall", 305, ["rough_in"]),
    t("finishes", "Construction", "Interior finishes", 345, ["insulation_drywall"]),
    t("exterior", "Construction", "Exterior finishes, flatwork and landscaping", 355, ["framing"]),
    t("final_trim", "Construction", "Fixtures, appliances and final trim", 365, ["finishes", "exterior"]),
    t("walkthrough", "Punch list", "Owner walkthrough", 370, ["final_trim"], "high"),
    t("punch_list", "Punch list", "Create punch list", 371, ["walkthrough"], "high"),
    t("punch_done", "Punch list", "Complete punch list items", 385, ["punch_list"], "high"),
    t("final_inspect", "Completion", "Final inspection and certificate of occupancy", 392, ["punch_done"], "high"),
    t("handover", "Completion", "Prepare project for handover", 398, ["final_inspect"]),
  ];
}

const DC: Agency = {
  permitOffice: "DC Department of Buildings",
  gas: "Washington Gas",
  water: "DC Water",
  power: "Pepco",
};
const MD: Agency = {
  permitOffice: "county permitting office",
  gas: "gas utility",
  water: "WSSC or local water authority",
  power: "electric utility",
};
const GENERIC: Agency = {
  permitOffice: "local permitting office",
  gas: "gas utility",
  water: "water utility",
  power: "electric utility",
};

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: "Renovation — DC",
    projectType: "renovation",
    jurisdiction: "DC",
    description: "Whole-house renovation / flip in the District of Columbia.",
    tasks: renovationTasks(DC),
  },
  {
    name: "Renovation — Maryland",
    projectType: "renovation",
    jurisdiction: "MD",
    description: "Whole-house renovation / flip in Maryland.",
    tasks: renovationTasks(MD),
  },
  {
    name: "New construction — generic",
    projectType: "new_construction",
    jurisdiction: null,
    description: "Ground-up single-family home. Adjust agency names for the jurisdiction.",
    tasks: newConstructionTasks(GENERIC),
  },
];
