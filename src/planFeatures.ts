export type PlanId = "free_preview" | "pro_planned";

export type FeatureId =
  | "excel_html_converter"
  | "text_case_converter"
  | "html_editor_single_page"
  | "html_editor_save_open_project"
  | "html_editor_multipage_zip"
  | "local_site_search"
  | "account_foundation"
  | "billing_foundation"
  | "app_language_foundation"
  | "future_batch_tools"
  | "future_account_cloud_features";

export type FeatureStatus = "available" | "planned" | "pro_planned";

export type PlanDefinition = {
  id: PlanId;
  label: string;
};

export type FeatureDefinition = {
  id: FeatureId;
  label: string;
  description: string;
  status: FeatureStatus;
  planLabel: string;
  visibleInToolsList: boolean;
  billingComparison: "free_preview" | "pro_planned" | null;
};

export const currentPlan: PlanDefinition = {
  id: "free_preview",
  label: "Free Preview",
};

export const proPlanned: PlanDefinition = {
  id: "pro_planned",
  label: "Pro Planned",
};

const featureDefinitions: readonly FeatureDefinition[] = [
  {
    id: "excel_html_converter",
    label: "Excel HTML Converter",
    description: "Convert Excel workbooks into HTML previews.",
    status: "available",
    planLabel: currentPlan.label,
    visibleInToolsList: true,
    billingComparison: "free_preview",
  },
  {
    id: "text_case_converter",
    label: "Text Case Converter",
    description: "Convert text between common letter-case formats.",
    status: "available",
    planLabel: currentPlan.label,
    visibleInToolsList: true,
    billingComparison: "free_preview",
  },
  {
    id: "html_editor_single_page",
    label: "HTML Editor single-page tools",
    description: "Build and copy a single HTML page with reusable blocks.",
    status: "available",
    planLabel: currentPlan.label,
    visibleInToolsList: true,
    billingComparison: "free_preview",
  },
  {
    id: "html_editor_save_open_project",
    label: "Save/Open Project",
    description: "Save and reopen an HTML Editor project locally.",
    status: "available",
    planLabel: currentPlan.label,
    visibleInToolsList: false,
    billingComparison: "free_preview",
  },
  {
    id: "account_foundation",
    label: "Account foundation",
    description: "Display-only account and license foundation.",
    status: "available",
    planLabel: currentPlan.label,
    visibleInToolsList: false,
    billingComparison: null,
  },
  {
    id: "billing_foundation",
    label: "Billing foundation",
    description: "Display-only billing and pricing foundation.",
    status: "available",
    planLabel: currentPlan.label,
    visibleInToolsList: false,
    billingComparison: null,
  },
  {
    id: "app_language_foundation",
    label: "App language foundation",
    description: "Settings foundation for future English and Japanese UI support.",
    status: "available",
    planLabel: currentPlan.label,
    visibleInToolsList: false,
    billingComparison: null,
  },
  {
    id: "html_editor_multipage_zip",
    label: "Multipage ZIP export",
    description: "Export a multipage HTML project as a ZIP archive.",
    status: "pro_planned",
    planLabel: proPlanned.label,
    visibleInToolsList: false,
    billingComparison: "pro_planned",
  },
  {
    id: "local_site_search",
    label: "Local site search",
    description: "Add local search support to exported sites.",
    status: "pro_planned",
    planLabel: proPlanned.label,
    visibleInToolsList: false,
    billingComparison: "pro_planned",
  },
  {
    id: "future_batch_tools",
    label: "More batch tools",
    description: "Additional batch-oriented desktop utilities.",
    status: "pro_planned",
    planLabel: proPlanned.label,
    visibleInToolsList: false,
    billingComparison: "pro_planned",
  },
  {
    id: "future_account_cloud_features",
    label: "Future account/cloud features",
    description: "Future account-connected and cloud-assisted features.",
    status: "pro_planned",
    planLabel: proPlanned.label,
    visibleInToolsList: false,
    billingComparison: "pro_planned",
  },
];

export function getCurrentPlan(): PlanDefinition {
  return currentPlan;
}

export function getFeatureById(id: FeatureId): FeatureDefinition | undefined {
  return featureDefinitions.find((feature) => feature.id === id);
}

export function getAvailableFeatures(): FeatureDefinition[] {
  return featureDefinitions.filter((feature) => feature.status === "available");
}

export function getProPlannedFeatures(): FeatureDefinition[] {
  return featureDefinitions.filter((feature) => feature.status === "pro_planned");
}

export function getFeaturesForBillingComparison(): {
  freePreview: FeatureDefinition[];
  proPlanned: FeatureDefinition[];
} {
  return {
    freePreview: featureDefinitions.filter((feature) => feature.billingComparison === "free_preview"),
    proPlanned: featureDefinitions.filter((feature) => feature.billingComparison === "pro_planned"),
  };
}
