const FIELD_META = {
  patientName: { label: "Patient name" },
  providerName: { label: "Provider name" },
  providerAddress: { label: "Provider address" },
  dateOfService: { label: "Date of service" },
  servicesText: { label: "Services provided", multiline: true },
  totalCost: { label: "Total cost", prefix: true },
  discounts: { label: "Discounts", prefix: true },
};

const ALL_KEYS = [
  "patientName",
  "providerName",
  "providerAddress",
  "dateOfService",
  "servicesText",
  "totalCost",
  "discounts",
];

const KNOWN_FIELD_KEYS = new Set(ALL_KEYS);

function slugForField(label) {
  const slug = String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug ? `custom_${slug}` : `custom_field`;
}

function fieldDefinition(rawLabel) {
  const label = String(rawLabel || "").trim();
  const line = label.toLowerCase();
  let key = null;
  if (/patient/.test(line)) key = "patientName";
  else if (/address/.test(line)) key = "providerAddress";
  else if (/provider/.test(line)) key = "providerName";
  else if (/date/.test(line)) key = "dateOfService";
  else if (/^(discounts?|adjustments?|savings?|write[- ]?offs?)$/.test(line)) key = "discounts";
  else if (/(service|procedure|treatment|line item|item|cpt)/.test(line)) key = "servicesText";
  else if (/^(total cost|total|amount|charge|price|balance|due|total due)$/.test(line)) key = "totalCost";

  const meta = key ? FIELD_META[key] : null;
  return {
    key: key || slugForField(label),
    label: meta?.label || label,
    sourceLabel: label,
    custom: !key,
    multiline: Boolean(meta?.multiline),
    prefix: Boolean(meta?.prefix) || /tax|subtotal|total|cost|amount|charge|price|balance|due|discount/i.test(label),
  };
}

function valueForField(bill, field) {
  if (KNOWN_FIELD_KEYS.has(field.key)) return String(bill[field.key] ?? "");
  return String(bill.customFields?.[field.key] ?? "");
}

function updateBillField(bill, field, value) {
  if (KNOWN_FIELD_KEYS.has(field.key)) {
    return { ...bill, [field.key]: value };
  }
  return {
    ...bill,
    customFields: {
      ...(bill.customFields || {}),
      [field.key]: value,
    },
  };
}

function normalizeRuleText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function ruleLines(text = state.rulesText) {
  return String(text || "")
    .split("\n")
    .map((line) => line.replace(/^[\s\-*\d.)]+/, "").trim())
    .filter(Boolean);
}

function normalizedInstructionsText(text = "") {
  return ruleLines(text).join("\n");
}

const DEFAULT_RULES_TEXT =
  "Patient name must be present\nProvider name must be present\nDate of service must be present\nSupplements are not covered\nCosmetic procedures are not covered";
const DEFAULT_EXTRACT_TEXT =
  "Patient name\nProvider name\nProvider address\nDate of service\nServices provided\nTotal cost\nDiscounts";
const DEFAULT_ANALYZED_RULES_TEXT = normalizedInstructionsText(DEFAULT_RULES_TEXT);

const state = {
  uid: 100,
  poolIdx: 0,
  bills: [
    {
      id: "b1",
      fileName: "riverside-1042.pdf",
      status: "done",
      patientName: "Maria Alvarez",
      providerName: "Riverside Family Medicine",
      providerAddress: "820 Cedar St, Suite 200, Portland, OR 97214",
      dateOfService: "2026-05-12",
      servicesText: "Office visit - established patient\nRoutine blood panel",
      totalCost: "284",
      discounts: "40",
      analyzedRulesText: DEFAULT_ANALYZED_RULES_TEXT,
      ruleEvaluations: [],
    },
    {
      id: "b2",
      fileName: "greenleaf-statement.pdf",
      status: "done",
      patientName: "David Chen",
      providerName: "GreenLeaf Wellness Center",
      providerAddress: "1455 Birch Ave, Austin, TX 78704",
      dateOfService: "2026-05-09",
      servicesText: "Vitamin D3 supplement\nHerbal immune supplement\nWellness consultation",
      totalCost: "215",
      discounts: "0",
      analyzedRulesText: DEFAULT_ANALYZED_RULES_TEXT,
      ruleEvaluations: [
        {
          rule: "Supplements are not covered",
          passed: false,
          detail: "The bill lists Vitamin D3 supplement and Herbal immune supplement as visible service line items.",
          confidence: 96,
        },
      ],
    },
    {
      id: "b3",
      fileName: "quicklab-scan.jpg",
      status: "done",
      patientName: "",
      providerName: "QuickLab Diagnostics",
      providerAddress: "77 Industrial Pkwy, Reno, NV 89502",
      dateOfService: "2026-05-15",
      servicesText: "Comprehensive metabolic panel\nLipid panel",
      totalCost: "162",
      discounts: "18",
      analyzedRulesText: DEFAULT_ANALYZED_RULES_TEXT,
      ruleEvaluations: [],
    },
    {
      id: "b4",
      fileName: "summit-ortho.pdf",
      status: "done",
      patientName: "Janet Okoro",
      providerName: "Summit Orthopedics",
      providerAddress: "3400 Alpine Rd, Denver, CO 80202",
      dateOfService: "2026-04-28",
      servicesText: "Knee X-ray (2 views)\nOrthopedic consultation",
      totalCost: "430",
      discounts: "65",
      analyzedRulesText: DEFAULT_ANALYZED_RULES_TEXT,
      ruleEvaluations: [],
    },
    {
      id: "b5",
      fileName: "bella-aesthetics.png",
      status: "done",
      patientName: "Sofia Romano",
      providerName: "Bella Aesthetics Clinic",
      providerAddress: "210 Palm Dr, Miami, FL 33139",
      dateOfService: "2026-05-03",
      servicesText: "Botox cosmetic injection\nDermal filler",
      totalCost: "680",
      discounts: "0",
      analyzedRulesText: DEFAULT_ANALYZED_RULES_TEXT,
      ruleEvaluations: [
        {
          rule: "Cosmetic procedures are not covered",
          passed: false,
          detail: "The bill lists Botox cosmetic injection and Dermal filler as visible service line items.",
          confidence: 97,
        },
      ],
    },
  ],
  selectedId: "b1",
  filter: "all",
  model: "",
  models: [],
  rulesText: DEFAULT_RULES_TEXT,
  extractText: DEFAULT_EXTRACT_TEXT,
  dragging: false,
  modelMenuOpen: false,
  rulesOpen: window.location.hash === "#rules",
  toastTimer: null,
};

const elements = {
  currentModel: document.querySelector("#current-model"),
  modelToggle: document.querySelector("#model-toggle"),
  modelBackdrop: document.querySelector("#model-backdrop"),
  modelMenu: document.querySelector("#model-menu"),
  rulesOpen: document.querySelector("#rules-open"),
  exportCsv: document.querySelector("#export-csv"),
  dropZone: document.querySelector("#drop-zone"),
  browseFiles: document.querySelector("#browse-files"),
  fileInput: document.querySelector("#file-input"),
  filters: document.querySelector("#filters"),
  billList: document.querySelector("#bill-list"),
  detailPane: document.querySelector("#detail-pane"),
  drawerBackdrop: document.querySelector("#drawer-backdrop"),
  rulesDrawer: document.querySelector("#rules-drawer"),
  rulesClose: document.querySelector("#rules-close"),
  rulesText: document.querySelector("#rules-text"),
  extractText: document.querySelector("#extract-text"),
  flaggedCount: document.querySelector("#flagged-count"),
  totalCount: document.querySelector("#total-count"),
  toast: document.querySelector("#toast"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value) {
  const amount = Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function numberValue(value) {
  return Number(String(value ?? "").replace(/[^0-9.-]/g, "")) || 0;
}

function formatDate(value) {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match ? new Date(+match[1], +match[2] - 1, +match[3]) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function modelInfo() {
  return state.models.find((model) => model.id === state.model) || state.models[0] || {
    id: "",
    meta: "Loading model options from server...",
  };
}

function modelLabel(model = modelInfo()) {
  return model.id || "Loading model...";
}

function modelDescription(model = modelInfo()) {
  return model.meta || "Configured in .env";
}

function fieldLabel(key) {
  return FIELD_META[key]?.label?.toLowerCase() || key.replace(/^custom_/, "").replace(/_/g, " ");
}

function servicesFor(bill) {
  return String(bill.servicesText || "")
    .split("\n")
    .map((service) => service.trim())
    .filter(Boolean);
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const percent = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, percent));
}

function confidenceFor(bill, key) {
  const source =
    key === "__overall" ? bill.confidence : bill.fieldConfidences?.[key] ?? bill.customFieldConfidences?.[key];
  const normalized = normalizeConfidence(source);
  return normalized === null ? null : normalized.toFixed(1);
}

function confidenceBadge(bill, key) {
  const confidence = confidenceFor(bill, key);
  return confidence === null ? "" : `<span class="confidence">${confidence}%</span>`;
}

function extractionSummary(bill) {
  const confidence = confidenceFor(bill, "__overall");
  const model = escapeHtml(bill.modelUsed || modelLabel());
  return confidence === null ? `Extracted with ${model} - confidence unavailable` : `Extracted with ${model} - ${confidence}% overall confidence`;
}

function fieldsFromText(line) {
  const clean = String(line || "")
    .replace(/\b(must|required|require|mandatory|need(?:s)? to|should|has to|have to|present|be|is|are)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return [];

  const fields = [];
  const seen = new Set();
  const addField = (rawLabel) => {
    const field = fieldDefinition(rawLabel);
    if (seen.has(field.key)) return;
    seen.add(field.key);
    fields.push(field);
  };

  clean
    .split(/\s*(?:,|;|\band\b|\bor\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach(addField);

  return fields.length ? fields : [fieldDefinition(clean)];
}

function subjectKeywords(value) {
  const stopWords = new Set([
    "the",
    "any",
    "all",
    "are",
    "is",
    "be",
    "must",
    "should",
    "and",
    "or",
    "of",
    "for",
    "to",
    "that",
    "this",
    "with",
    "will",
    "not",
    "covered",
    "eligible",
    "allowed",
    "excluded",
    "bill",
    "bills",
    "claim",
    "claims",
    "service",
    "services",
    "do",
    "does",
    "dont",
    "cover",
    "reimbursable",
    "permitted",
    "present",
    "required",
    "mandatory",
    "need",
    "needs",
    "from",
    "its",
    "our",
    "was",
    "were",
    "they",
    "them",
    "such",
  ]);

  const out = [];
  String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .map((token) => token.replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .forEach((token) => {
      if (stopWords.has(token)) return;
      const hasHyphen = token.includes("-");
      if (!hasHyphen && token.length < 3) return;
      let key = token;
      if (!hasHyphen && key.length > 4 && key.endsWith("s")) key = key.slice(0, -1);
      if (!out.includes(key)) out.push(key);
    });
  return out;
}

function parseRules(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.replace(/^[\s\-*\d.)]+/, "").trim())
    .filter(Boolean)
    .map((raw) => {
      const line = raw.toLowerCase();
      const excluded = line.match(
        /(.*?)\b(are not covered|is not covered|aren'?t covered|isn'?t covered|not covered|not eligible|ineligible|not allowed|are excluded|is excluded|excluded|do(?:es)? not cover|don'?t cover|not reimbursable|not permitted|never covered)\b/
      );
      const requires = /(must|required|require|mandatory|need(?:s)? to|should|has to|have to|present)/.test(line);
      if (excluded) {
        let keywords = subjectKeywords(excluded[1] || line);
        if (!keywords.length) keywords = subjectKeywords(line);
        return { kind: "excluded", keywords, raw, ok: keywords.length > 0 };
      }

      const noMatch = line.match(/\bno\s+([a-z][a-z\- ]{2,})/);
      if (noMatch && !requires) {
        const keywords = subjectKeywords(noMatch[1]);
        if (keywords.length) return { kind: "excluded", keywords, raw, ok: true };
      }

      const fields = fieldsFromText(line);
      if (fields.length && (requires || /present|required|mandatory/.test(line))) {
        return { kind: "required", fields, raw, ok: true };
      }

      return { kind: "unknown", raw, ok: false };
    });
}

function parseExtract(text) {
  const seen = new Set();
  const fields = [];
  String(text || "")
    .split("\n")
    .map((line) => line.replace(/^[\s\-*\d.)]+/, "").trim())
    .filter(Boolean)
    .forEach((raw) => {
      const field = fieldDefinition(raw);
      if (seen.has(field.key)) return;
      seen.add(field.key);
      fields.push(field);
    });
  return { fields, keys: fields.map((field) => field.key), unmatched: [] };
}

function ruleReviewState(bill) {
  const currentRules = ruleLines(state.rulesText);
  const analyzedRules = ruleLines(bill.analyzedRulesText || "");
  const currentText = normalizedInstructionsText(state.rulesText);
  const analyzedText = normalizedInstructionsText(bill.analyzedRulesText || "");
  const hasRuleEvaluations = Array.isArray(bill.ruleEvaluations);
  const analyzedRuleKeys = new Set(analyzedRules.map(normalizeRuleText));
  const unevaluatedRules = hasRuleEvaluations
    ? currentRules.filter((rule) => !analyzedRuleKeys.has(normalizeRuleText(rule)))
    : currentRules;

  return {
    analyzedRuleCount: hasRuleEvaluations ? analyzedRules.length : 0,
    currentRuleCount: currentRules.length,
    hasRuleEvaluations,
    isStale: hasRuleEvaluations && analyzedText !== currentText,
    unevaluatedRules,
  };
}

function modelRuleFlagsFor(bill) {
  if (!Array.isArray(bill.ruleEvaluations)) return [];

  return bill.ruleEvaluations
    .filter((evaluation) => evaluation && evaluation.passed === false)
    .map((evaluation) => ({
      label: evaluation.rule || "Eligibility rule",
      detail: evaluation.detail || "The model found that this bill does not satisfy the rule.",
      confidence: normalizeConfidence(evaluation.confidence),
    }));
}

function evaluateBill(bill) {
  return modelRuleFlagsFor(bill);
}

function evaluatedBills() {
  return state.bills.map((bill) => ({
    ...bill,
    flags: bill.status === "processing" || bill.status === "error" ? [] : evaluateBill(bill),
  }));
}

function ineligibilityReason(bill) {
  if (!bill.flags?.length) return "";
  return bill.flags.map((flag) => `${flag.label}: ${flag.detail}`).join(" | ");
}

function statusFor(bill) {
  if (bill.status === "processing") {
    return { key: "processing", label: "Processing", color: "#d97706", bg: "rgba(217, 119, 6, .12)" };
  }
  if (bill.status === "error") {
    return { key: "error", label: "Error", color: "#e11d48", bg: "rgba(225, 29, 72, .1)" };
  }
  if (bill.flags.length) {
    return { key: "flagged", label: "Flagged", color: "#e11d48", bg: "rgba(225, 29, 72, .1)" };
  }
  return { key: "eligible", label: "Eligible", color: "#059669", bg: "rgba(5, 150, 105, .12)" };
}

function visibleBills(evaluated) {
  return evaluated.filter((bill) => {
    if (state.filter === "all") return true;
    if (bill.status === "processing" || bill.status === "error") return false;
    if (state.filter === "flagged") return bill.flags.length > 0;
    if (state.filter === "eligible") return bill.flags.length === 0;
    return true;
  });
}

function renderModelMenu() {
  elements.currentModel.textContent = modelLabel();
  elements.modelToggle.setAttribute("aria-expanded", String(state.modelMenuOpen));
  elements.modelBackdrop.classList.toggle("hidden", !state.modelMenuOpen);
  elements.modelMenu.classList.toggle("hidden", !state.modelMenuOpen);
  elements.modelMenu.innerHTML = `
    <div class="menu-label">Pick a model</div>
    ${state.models.map(
      (model) => `
        <button class="model-option ${model.id === state.model ? "active" : ""}" type="button" data-model="${model.id}">
          <span class="option-dot"></span>
          <span>
            <strong>${escapeHtml(modelLabel(model))}</strong>
            <small>${escapeHtml(modelDescription(model))}</small>
          </span>
        </button>
      `
    ).join("")}
  `;
}

function renderFilters(evaluated) {
  const counts = {
    all: evaluated.length,
    flagged: evaluated.filter((bill) => bill.status !== "processing" && bill.status !== "error" && bill.flags.length).length,
    eligible: evaluated.filter((bill) => bill.status !== "processing" && bill.status !== "error" && !bill.flags.length).length,
  };
  const filters = [
    { key: "all", label: "All" },
    { key: "flagged", label: "Flagged" },
    { key: "eligible", label: "Eligible" },
  ];
  elements.filters.innerHTML = filters
    .map(
      (filter) => `
        <button class="filter-button ${state.filter === filter.key ? "active" : ""}" type="button" data-filter="${filter.key}">
          ${filter.label}<span>${counts[filter.key]}</span>
        </button>
      `
    )
    .join("");
}

function renderBillList(evaluated) {
  const bills = visibleBills(evaluated);
  if (!bills.length) {
    elements.billList.innerHTML = `<div class="empty-list">No bills in this view.</div>`;
    return;
  }

  elements.billList.innerHTML = bills
    .map((bill) => {
      const status = statusFor(bill);
      const provider =
        bill.status === "processing"
          ? "Extracting data and analyzing eligibility rules..."
          : bill.status === "error"
            ? bill.error || "Analysis failed"
            : bill.providerName || "Unknown provider";
      const total = bill.status === "processing" || bill.status === "error" ? "" : money(bill.totalCost);
      return `
        <div class="bill-card ${bill.id === state.selectedId ? "active" : ""}" data-bill="${bill.id}">
          <div class="bill-card-header">
            <span class="bill-dot ${status.key}" style="background:${status.color}"></span>
            <span class="bill-name">${escapeHtml(bill.fileName)}</span>
            <span class="status-pill" style="color:${status.color};background:${status.bg}">${status.label}</span>
            <button class="bill-delete" type="button" data-delete-bill="${bill.id}" aria-label="Delete ${escapeHtml(bill.fileName)}">x</button>
          </div>
          <div class="bill-card-body">
            <span class="bill-provider">${escapeHtml(provider)}</span>
            <span class="bill-total">${escapeHtml(total)}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function deleteBill(id) {
  const remaining = state.bills.filter((bill) => bill.id !== id);
  state.bills = remaining;
  if (state.selectedId === id) {
    state.selectedId = remaining[0]?.id || null;
  }
  render();
}
function renderProcessing(bill) {
  elements.detailPane.innerHTML = `
    <div class="selection-state">
      <div class="spinner"></div>
      <strong>Extracting data with ${escapeHtml(modelLabel())}...</strong>
      <span>Reading ${escapeHtml(bill.fileName)} - detecting fields and services</span>
    </div>
  `;
}

function renderError(bill) {
  elements.detailPane.innerHTML = `
    <div class="selection-state">
      <strong>Analysis failed</strong>
      <span>${escapeHtml(bill.error || "The bill could not be analyzed.")}</span>
    </div>
  `;
}

function renderEmptySelection() {
  elements.detailPane.innerHTML = `
    <div class="selection-state">
      <span>Select a bill to view extracted data.</span>
    </div>
  `;
}

function createSourcePages(files) {
  return files.map((file, index) => ({
    index: index + 1,
    name: file.name || `Page ${index + 1}`,
    type: file.type || "application/octet-stream",
    url: URL.createObjectURL(file),
    kind: (file.type || "").startsWith("image/") ? "image" : "document",
  }));
}

function renderSourceDocument(bill) {
  if (!bill.sourcePages || !bill.sourcePages.length) {
    return renderPaper(bill);
  }

  return `
    <div class="column-label">Source document</div>
    <div class="source-pages">
      ${bill.sourcePages
        .map(
          (page) => `
            <div class="source-page">
              <div class="source-page-header">
                <span>Page ${page.index}</span>
                <span>${escapeHtml(page.name)}</span>
              </div>
              <div class="source-page-body">
                ${
                  page.kind === "image"
                    ? `<img src="${escapeHtml(page.url)}" alt="${escapeHtml(page.name)}" />`
                    : `<object data="${escapeHtml(page.url)}" type="${escapeHtml(page.type)}">
                        <a class="source-page-fallback" href="${escapeHtml(page.url)}" target="_blank" rel="noreferrer">Open ${escapeHtml(page.name)}</a>
                      </object>`
                }
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}
function renderPaper(bill) {
  const services = servicesFor(bill);
  const subtotal = numberValue(bill.totalCost) + numberValue(bill.discounts);
  const discount = numberValue(bill.discounts);
  return `
    <div class="column-label">Source document</div>
    <div class="paper">
      <div class="paper-top">
        <div>
          <div class="paper-provider">${escapeHtml(bill.providerName || "-")}</div>
          <div class="paper-address">${escapeHtml(bill.providerAddress || "-")}</div>
        </div>
        <div>
          <div class="paper-label">Statement</div>
          <div class="paper-date">${escapeHtml(formatDate(bill.dateOfService))}</div>
        </div>
      </div>
      <div class="paper-rule"></div>
      <div class="paper-meta">
        <div>
          <div class="paper-label">Patient</div>
          <strong>${escapeHtml(bill.patientName || "-")}</strong>
        </div>
        <div>
          <div class="paper-label">Date of service</div>
          <strong>${escapeHtml(formatDate(bill.dateOfService))}</strong>
        </div>
      </div>
      <div class="paper-label">Services provided</div>
      <div>
        ${services
          .map(
            (service, index) => `
              <div class="service-row">
                <span>${escapeHtml(service)}</span>
                <span>SVC-${100 + index}</span>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="totals">
        <div><span>Subtotal</span><span>${money(subtotal)}</span></div>
        ${
          discount > 0
            ? `<div><span>Discount</span><span style="color:#0f766e">-${money(discount)}</span></div>`
            : ""
        }
        <div class="total-due"><span>Total due</span><span>${money(bill.totalCost)}</span></div>
      </div>
      <div class="barcode" aria-hidden="true"></div>
    </div>
  `;
}

function requiredFieldsFromRules() {
  const fields = new Set();
  parseRules(state.rulesText)
    .filter((rule) => rule.ok && rule.kind === "required")
    .forEach((rule) => rule.fields.forEach((field) => fields.add(field.key)));
  return fields;
}

function renderFields(bill) {
  const extract = parseExtract(state.extractText);
  const fields = extract.fields.length ? extract.fields : ALL_KEYS.map((key) => fieldDefinition(FIELD_META[key].label));
  const required = requiredFieldsFromRules();

  return fields
    .map((field) => {
      const value = valueForField(bill, field);
      const isMissing = required.has(field.key) && !value.trim();
      const id = `field-${field.key}`;
      const input = field.multiline
        ? `<textarea id="${id}" rows="3" data-field="${field.key}" class="${isMissing ? "missing" : ""}">${escapeHtml(value)}</textarea>`
        : `
          <div class="field-input-wrap">
            ${field.prefix ? `<span class="currency-prefix">$</span>` : ""}
            <input id="${id}" data-field="${field.key}" class="${field.prefix ? "money-input" : ""} ${
            isMissing ? "missing" : ""
          }" value="${escapeHtml(value)}" />
          </div>
        `;

      return `
        <div class="field-row">
          <div class="field-header">
            <label for="${id}">${escapeHtml(field.label)}</label>
            ${isMissing ? `<span class="missing-pill">MISSING</span>` : ""}
            ${confidenceBadge(bill, field.key)}
          </div>
          ${input}
        </div>
      `;
    })
    .join("");
}

function sourceKeyForBill(bill) {
  const sourceUrls = (bill.sourcePages || []).map((page) => page.url).join("|");
  return `${bill.id}:${sourceUrls || "mock"}`;
}

function renderSelectionHeader(bill, evaluatedBill) {
  const status = statusFor(evaluatedBill);
  const flagged = evaluatedBill.flags.length > 0;
  return `
    <div class="selection-header">
      <div class="selection-title">
        <strong>${escapeHtml(bill.fileName)}</strong>
        <span>${extractionSummary(bill)}</span>
      </div>
      <div class="header-fill"></div>
      <span class="status-pill" style="color:${status.color};background:${status.bg}">
        ${flagged ? `${status.label} - ${evaluatedBill.flags.length} issue${evaluatedBill.flags.length === 1 ? "" : "s"}` : status.label}
      </span>
      <button class="rerun-button" id="rerun-analysis" type="button">Re-run</button>
    </div>
  `;
}

function renderAnalysisColumn(bill, evaluatedBill) {
  const flagged = evaluatedBill.flags.length > 0;
  const review = ruleReviewState(bill);
  const evaluatedRuleCount = review.hasRuleEvaluations ? review.analyzedRuleCount : review.currentRuleCount;
  const ruleCountLabel = review.isStale ? "last analyzed eligibility rules" : "active eligibility rules";
  const needsRuleEvaluation = review.isStale && review.unevaluatedRules.length > 0;
  const rulesChanged = review.isStale && !review.unevaluatedRules.length;
  return `
    <div class="analysis-column">
      <div class="verdict ${flagged ? "flagged" : "eligible"}">
        <div class="verdict-icon">${flagged ? "!" : "OK"}</div>
        <div>
          <h2>${flagged ? "Flagged for review" : "Eligible"}</h2>
          <p>${
            flagged
              ? `Fails ${evaluatedBill.flags.length} of ${evaluatedRuleCount} ${ruleCountLabel}`
              : `Passes all ${evaluatedRuleCount} ${ruleCountLabel}`
          }</p>
          ${
            flagged
              ? `<div class="flag-list">${evaluatedBill.flags
                  .map(
                    (flag) => `
                      <div class="flag-item">
                        <div>
                          <strong>${escapeHtml(flag.label)}</strong>
                          <span>${escapeHtml(flag.detail)}</span>
                        </div>
                      </div>
                    `
                  )
                  .join("")}</div>`
              : ""
          }
          ${
            needsRuleEvaluation
              ? `<div class="rule-refresh-notice"><strong>${review.unevaluatedRules.length} new rule${review.unevaluatedRules.length === 1 ? "" : "s"} must be evaluated</strong><span>Click Re-run to analyze ${review.unevaluatedRules.length === 1 ? "this rule" : "these rules"} for this bill.</span></div>`
              : rulesChanged
                ? `<div class="rule-refresh-notice"><strong>Eligibility rules changed</strong><span>Click Re-run to refresh this bill's rule analysis.</span></div>`
                : ""
          }
        </div>
      </div>

      <div class="section-heading">
        <span>Extracted data</span>
        <button class="link-button" id="edit-fields" type="button">Edit fields</button>
      </div>
      <div class="field-stack">${renderFields(bill)}</div>
    </div>
  `;
}

function renderDetail(evaluated) {
  const bill = state.bills.find((item) => item.id === state.selectedId);
  const evaluatedBill = evaluated.find((item) => item.id === state.selectedId);
  if (!bill || !evaluatedBill) {
    renderEmptySelection();
    return;
  }
  if (bill.status === "processing") {
    renderProcessing(bill);
    return;
  }
  if (bill.status === "error") {
    renderError(bill);
    return;
  }

  const sourceKey = sourceKeyForBill(bill);
  const headerHtml = renderSelectionHeader(bill, evaluatedBill);
  const analysisHtml = renderAnalysisColumn(bill, evaluatedBill);
  const canReuseSource =
    elements.detailPane.dataset.view === "ready" &&
    elements.detailPane.dataset.billId === bill.id &&
    elements.detailPane.dataset.sourceKey === sourceKey &&
    elements.detailPane.querySelector(".source-column");

  if (canReuseSource) {
    const header = elements.detailPane.querySelector(".selection-header");
    const analysis = elements.detailPane.querySelector(".analysis-column");
    if (header) header.outerHTML = headerHtml;
    if (analysis) analysis.outerHTML = analysisHtml;
    return;
  }

  elements.detailPane.dataset.view = "ready";
  elements.detailPane.dataset.billId = bill.id;
  elements.detailPane.dataset.sourceKey = sourceKey;
  elements.detailPane.innerHTML = `
    ${headerHtml}
    <div class="content-grid">
      <div class="source-column">${renderSourceDocument(bill)}</div>
      ${analysisHtml}
    </div>
  `;
}


function renderDrawer(evaluated) {
  elements.drawerBackdrop.classList.toggle("hidden", !state.rulesOpen);
  elements.rulesDrawer.classList.toggle("hidden", !state.rulesOpen);
  elements.rulesText.value = state.rulesText;
  elements.extractText.value = state.extractText;
  updateDrawerCounts(evaluated);
}

function updateDrawerCounts(evaluated = evaluatedBills()) {
  elements.flaggedCount.textContent = evaluated.filter((bill) => bill.status !== "processing" && bill.status !== "error" && bill.flags.length).length;
  elements.totalCount.textContent = evaluated.filter((bill) => bill.status !== "processing" && bill.status !== "error").length;
}

function render() {
  const evaluated = evaluatedBills();
  elements.dropZone.classList.toggle("dragging", state.dragging);
  renderModelMenu();
  renderFilters(evaluated);
  renderBillList(evaluated);
  renderDetail(evaluated);
  renderDrawer(evaluated);
}

function flash(message) {
  const text = elements.toast.querySelector("p");
  text.textContent = message;
  elements.toast.classList.remove("hidden");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 2600);
}

async function addFiles(files) {
  if (!files.length) return;
  const documents = [...files];
  const newBills = documents.map((file) => ({
    id: `u${state.uid++}`,
    fileName: file?.name || "uploaded-bill.pdf",
    status: "processing",
    pageCount: 1,
    sourceFiles: [file],
    sourcePages: createSourcePages([file]),
  }));

  state.bills = [...newBills, ...state.bills];
  state.selectedId = newBills[0].id;
  state.dragging = false;
  render();

  await Promise.all(newBills.map((bill) => analyzeBill(bill.id, bill.sourceFiles)));
}

function mockBillText(bill) {
  return [
    `File name: ${bill.fileName || "mock-bill"}`,
    `Patient name: ${bill.patientName || ""}`,
    `Provider name: ${bill.providerName || ""}`,
    `Provider address: ${bill.providerAddress || ""}`,
    `Date of service: ${bill.dateOfService || ""}`,
    "Services provided:",
    servicesFor(bill).join("\n"),
    `Total cost: ${bill.totalCost || ""}`,
    `Discounts: ${bill.discounts || ""}`,
  ].join("\n");
}
function applyExtractedFields(billData, extractText = state.extractText) {
  const fields = parseExtract(extractText).fields;
  const customFields = { ...(billData.customFields || {}) };
  const fieldConfidences = { ...(billData.fieldConfidences || {}) };
  const customFieldConfidences = { ...(billData.customFieldConfidences || {}) };
  const returned = Array.isArray(billData.extractedFields) ? billData.extractedFields : [];

  fields.forEach((field) => {
    const match = returned.find((item) => normalizeRuleText(item.label) === normalizeRuleText(field.sourceLabel || field.label));
    if (!match) return;
    const value = String(match.value ?? "");
    const confidence = normalizeConfidence(match.confidence);
    if (KNOWN_FIELD_KEYS.has(field.key)) {
      billData[field.key] = value;
      if (confidence !== null) fieldConfidences[field.key] = confidence;
    } else {
      customFields[field.key] = value;
      if (confidence !== null) customFieldConfidences[field.key] = confidence;
    }
  });

  return {
    ...billData,
    customFields,
    fieldConfidences,
    customFieldConfidences,
  };
}
async function analyzeBill(id, pages = [], billSnapshot = null) {
  const rulesForAnalysis = state.rulesText;
  const extractForAnalysis = state.extractText;
  const formData = new FormData();
  pages.forEach((page) => formData.append("pages", page, page.name));
  if (!pages.length && billSnapshot) {
    formData.append("billText", mockBillText(billSnapshot));
    formData.append("billFileName", billSnapshot.fileName || "mock-bill");
  }
  formData.append("rulesText", rulesForAnalysis);
  formData.append("extractText", extractForAnalysis);
  formData.append("model", state.model);

  try {
    const response = await fetch("/api/analyze-bill", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "OpenAI analysis failed.");
    }

    state.bills = state.bills.map((bill) =>
      bill.id === id
        ? {
            ...bill,
            ...applyExtractedFields(payload.bill || {}, extractForAnalysis),
            fileName: payload.fileName || bill.fileName,
            pageCount: payload.pageCount || bill.pageCount,
            modelUsed: payload.model,
            analyzedRulesText: normalizedInstructionsText(rulesForAnalysis),
            analyzedExtractText: normalizedInstructionsText(extractForAnalysis),
            status: "done",
          }
        : bill
    );
    render();
    const analyzedCount = payload.pageCount || pages.length || 1;
    flash(`Analyzed ${analyzedCount} page${analyzedCount === 1 ? "" : "s"} with OpenAI`);
  } catch (error) {
    state.bills = state.bills.map((bill) =>
      bill.id === id ? { ...bill, status: "error", error: error.message || "OpenAI analysis failed." } : bill
    );
    render();
    flash("OpenAI analysis failed");
  }
}

async function reRunSelectedBill() {
  const bill = state.bills.find((item) => item.id === state.selectedId);
  if (!bill) return;

  const sourceFiles = bill.sourceFiles || [];

  state.bills = state.bills.map((item) =>
    item.id === bill.id ? { ...item, status: "processing", error: null } : item
  );
  render();
  await analyzeBill(bill.id, sourceFiles, sourceFiles.length ? null : bill);
}
function exportCsv() {
  const bills = evaluatedBills().filter((bill) => bill.status !== "processing" && bill.status !== "error");
  const extract = parseExtract(state.extractText);
  const columns = extract.fields.length ? extract.fields : ALL_KEYS.map((key) => fieldDefinition(FIELD_META[key].label));
  const header = ["File", ...columns.map((field) => field.label), "Eligibility", "Flags", "Ineligibility reason", "Model"];
  const rows = [header];

  bills.forEach((bill) => {
    const cells = columns.map((field) => {
      if (field.key === "servicesText") return servicesFor(bill).join("; ");
      const value = valueForField(bill, field);
      if (field.prefix) return money(value);
      return value;
    });
    rows.push([
      bill.fileName,
      ...cells,
      bill.flags.length ? "Flagged" : "Eligible",
      bill.flags.map((flag) => flag.label).join(" | "),
      ineligibilityReason(bill),
      bill.modelUsed || modelLabel(),
    ]);
  });

  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(",")
    )
    .join("\r\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "eligibility-results.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
  flash(`Exported ${bills.length} bills to eligibility-results.csv`);
}

function bindEvents() {
  elements.modelToggle.addEventListener("click", () => {
    state.modelMenuOpen = !state.modelMenuOpen;
    render();
  });

  elements.modelBackdrop.addEventListener("click", () => {
    state.modelMenuOpen = false;
    render();
  });

  elements.modelMenu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-model]");
    if (!button) return;
    const nextModel = button.dataset.model;
    state.modelMenuOpen = false;

    if (nextModel !== state.model) {
      state.model = nextModel;
      render();
      flash(`Selected ${modelLabel()}`);
      return;
    }

    render();
  });

  elements.rulesOpen.addEventListener("click", () => {
    state.rulesOpen = true;
    render();
  });

  elements.rulesClose.addEventListener("click", () => {
    state.rulesOpen = false;
    render();
  });

  elements.drawerBackdrop.addEventListener("click", () => {
    state.rulesOpen = false;
    render();
  });

  elements.exportCsv.addEventListener("click", exportCsv);

  elements.browseFiles.addEventListener("click", () => {
    elements.fileInput.click();
  });

  elements.fileInput.addEventListener("change", (event) => {
    addFiles([...event.target.files]);
    event.target.value = "";
  });

  elements.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    state.dragging = true;
    render();
  });

  elements.dropZone.addEventListener("dragleave", (event) => {
    event.preventDefault();
    state.dragging = false;
    render();
  });

  elements.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    state.dragging = false;
    addFiles([...event.dataTransfer.files]);
  });

  elements.filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    render();
  });

  elements.billList.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-bill]");
    if (deleteButton) {
      deleteBill(deleteButton.dataset.deleteBill);
      return;
    }

    const billCard = event.target.closest("[data-bill]");
    if (!billCard) return;
    state.selectedId = billCard.dataset.bill;
    render();
  });

  elements.detailPane.addEventListener("click", (event) => {
    if (event.target.closest("#rerun-analysis")) {
      reRunSelectedBill();
    }
    if (event.target.closest("#edit-fields")) {
      state.rulesOpen = true;
      render();
    }
  });

  elements.detailPane.addEventListener("change", (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    state.bills = state.bills.map((bill) =>
      bill.id === state.selectedId ? updateBillField(bill, { key: field }, event.target.value) : bill
    );
    render();
  });

  elements.rulesText.addEventListener("input", (event) => {
    state.rulesText = event.target.value;
    const evaluated = evaluatedBills();
    updateDrawerCounts(evaluated);
    renderFilters(evaluated);
    renderBillList(evaluated);
    renderDetail(evaluated);
  });

  elements.extractText.addEventListener("input", (event) => {
    state.extractText = event.target.value;
    renderDetail(evaluatedBills());
  });
}

bindEvents();
loadServerConfig();
render();

async function loadServerConfig() {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) return;
    const config = await response.json();
    if (config.model) {
      state.models = Array.isArray(config.models) ? config.models : state.models;
      state.model = config.model;
      render();
    }
  } catch {
    // Opening index.html directly keeps the static demo usable.
  }
}
