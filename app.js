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
    },
  ],
  uploadPool: [
    {
      patientName: "Marcus Lee",
      providerName: "Harbor Physical Therapy",
      providerAddress: "58 Wharf Rd, Seattle, WA 98101",
      dateOfService: "2026-05-18",
      servicesText: "Physical therapy session\nTherapeutic exercise",
      totalCost: "175",
      discounts: "25",
    },
    {
      patientName: "Priya Nair",
      providerName: "Pure Living Nutrition",
      providerAddress: "900 Maple Blvd, San Jose, CA 95112",
      dateOfService: "2026-05-16",
      servicesText: "Magnesium supplement\nProbiotic supplement",
      totalCost: "130",
      discounts: "0",
    },
    {
      patientName: "",
      providerName: "Northgate Dermatology",
      providerAddress: "42 Glen Way, Columbus, OH 43215",
      dateOfService: "2026-05-14",
      servicesText: "Cosmetic mole removal\nSkin consultation",
      totalCost: "520",
      discounts: "50",
    },
    {
      patientName: "Aisha Bello",
      providerName: "Cedar Mental Health",
      providerAddress: "310 Pine St, Madison, WI 53703",
      dateOfService: "2026-05-17",
      servicesText: "Therapy session - 50 min",
      totalCost: "160",
      discounts: "0",
    },
  ],
  selectedId: "b1",
  filter: "all",
  model: "",
  models: [],
  rulesText:
    "Patient name must be present\nProvider name must be present\nDate of service must be present\nSupplements are not covered\nCosmetic procedures are not covered",
  extractText:
    "Patient name\nProvider name\nProvider address\nDate of service\nServices provided\nTotal cost\nDiscounts",
  dragging: false,
  modelMenuOpen: false,
  rulesOpen: false,
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
  sampleBatch: document.querySelector("#sample-batch"),
  fileInput: document.querySelector("#file-input"),
  filters: document.querySelector("#filters"),
  billList: document.querySelector("#bill-list"),
  detailPane: document.querySelector("#detail-pane"),
  drawerBackdrop: document.querySelector("#drawer-backdrop"),
  rulesDrawer: document.querySelector("#rules-drawer"),
  rulesClose: document.querySelector("#rules-close"),
  rulesText: document.querySelector("#rules-text"),
  extractText: document.querySelector("#extract-text"),
  rulePreview: document.querySelector("#rule-preview"),
  extractPreview: document.querySelector("#extract-preview"),
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

function fieldConfidenceBase() {
  return 96;
}

function fieldLabel(key) {
  return FIELD_META[key]?.label?.toLowerCase() || key;
}

function servicesFor(bill) {
  return String(bill.servicesText || "")
    .split("\n")
    .map((service) => service.trim())
    .filter(Boolean);
}

function confidenceFor(bill, key) {
  if (key === "__overall" && Number.isFinite(Number(bill.confidence))) {
    return Number(bill.confidence).toFixed(1);
  }
  const base = fieldConfidenceBase();
  let hash = 0;
  const input = `${bill.id || ""}${key}`;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 1000;
  }
  const confidence = Math.max(82, Math.min(99.8, base + (hash / 1000 - 0.5) * 5));
  return confidence.toFixed(1);
}

function fieldsFromText(line) {
  const fields = [];
  if (/patient/.test(line)) fields.push("patientName");
  if (/provider/.test(line) && /name/.test(line)) fields.push("providerName");
  else if (/provider/.test(line) && !/address/.test(line)) fields.push("providerName");
  if (/address/.test(line)) fields.push("providerAddress");
  if (/date/.test(line)) fields.push("dateOfService");
  if (/(total|cost|amount|charge|price|balance)/.test(line)) fields.push("totalCost");
  return [...new Set(fields)];
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
  const keys = [];
  const unmatched = [];
  String(text || "")
    .split("\n")
    .map((line) => line.replace(/^[\s\-*\d.)]+/, "").trim())
    .filter(Boolean)
    .forEach((raw) => {
      const line = raw.toLowerCase();
      let key = null;
      if (/patient/.test(line)) key = "patientName";
      else if (/address/.test(line)) key = "providerAddress";
      else if (/provider/.test(line)) key = "providerName";
      else if (/date/.test(line)) key = "dateOfService";
      else if (/(discount|adjustment|saving|write[- ]?off)/.test(line)) key = "discounts";
      else if (/(service|procedure|treatment|line item|item|cpt)/.test(line)) key = "servicesText";
      else if (/(total|cost|amount|charge|price|balance|due)/.test(line)) key = "totalCost";
      if (key && !keys.includes(key)) keys.push(key);
      if (!key) unmatched.push(raw);
    });
  return { keys, unmatched };
}

function evaluateBill(bill, parsedRules) {
  const flags = [];
  const services = servicesFor(bill);
  parsedRules.forEach((rule) => {
    if (rule.kind === "required") {
      rule.fields.forEach((field) => {
        if (!String(bill[field] || "").trim()) {
          flags.push({ label: rule.raw, detail: `No ${fieldLabel(field)} detected on the bill` });
        }
      });
      return;
    }

    if (rule.kind === "excluded") {
      const matched = services.filter((service) => {
        const serviceLine = service.toLowerCase();
        return rule.keywords.some((keyword) => serviceLine.includes(keyword));
      });
      if (matched.length) {
        flags.push({ label: rule.raw, detail: `Matched: ${matched.join(", ")}` });
      }
    }
  });
  return flags;
}

function evaluatedBills() {
  const rules = parseRules(state.rulesText).filter((rule) => rule.ok);
  return state.bills.map((bill) => ({
    ...bill,
    flags: bill.status === "processing" || bill.status === "error" ? [] : evaluateBill(bill, rules),
  }));
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
    <div class="menu-label">Server OpenAI models</div>
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
          ? "Extracting data..."
          : bill.status === "error"
            ? bill.error || "Analysis failed"
            : bill.providerName || "Unknown provider";
      const total = bill.status === "processing" || bill.status === "error" ? "" : money(bill.totalCost);
      return `
        <button class="bill-card ${bill.id === state.selectedId ? "active" : ""}" type="button" data-bill="${bill.id}">
          <div class="bill-card-header">
            <span class="bill-dot ${status.key}" style="background:${status.color}"></span>
            <span class="bill-name">${escapeHtml(bill.fileName)}</span>
            <span class="status-pill" style="color:${status.color};background:${status.bg}">${status.label}</span>
          </div>
          <div class="bill-card-body">
            <span class="bill-provider">${escapeHtml(provider)}</span>
            <span class="bill-total">${escapeHtml(total)}</span>
          </div>
        </button>
      `;
    })
    .join("");
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
    .forEach((rule) => rule.fields.forEach((field) => fields.add(field)));
  return fields;
}

function renderFields(bill) {
  const extract = parseExtract(state.extractText);
  const keys = extract.keys.length ? extract.keys : ALL_KEYS;
  const required = requiredFieldsFromRules();

  return keys
    .map((key) => {
      const meta = FIELD_META[key] || { label: key };
      const value = String(bill[key] ?? "");
      const isMissing = required.has(key) && !value.trim();
      const id = `field-${key}`;
      const input = meta.multiline
        ? `<textarea id="${id}" rows="3" data-field="${key}" class="${isMissing ? "missing" : ""}">${escapeHtml(value)}</textarea>`
        : `
          <div class="field-input-wrap">
            ${meta.prefix ? `<span class="currency-prefix">$</span>` : ""}
            <input id="${id}" data-field="${key}" class="${meta.prefix ? "money-input" : ""} ${
            isMissing ? "missing" : ""
          }" value="${escapeHtml(value)}" />
          </div>
        `;

      return `
        <div class="field-row">
          <div class="field-header">
            <label for="${id}">${escapeHtml(meta.label)}</label>
            ${isMissing ? `<span class="missing-pill">MISSING</span>` : ""}
            <span class="confidence">${confidenceFor(bill, key)}%</span>
          </div>
          ${input}
        </div>
      `;
    })
    .join("");
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

  const status = statusFor(evaluatedBill);
  const flagged = evaluatedBill.flags.length > 0;
  const parsedRuleCount = parseRules(state.rulesText).filter((rule) => rule.ok).length;

  elements.detailPane.innerHTML = `
    <div class="selection-header">
      <div class="selection-title">
        <strong>${escapeHtml(bill.fileName)}</strong>
        <span>Extracted with ${escapeHtml(bill.modelUsed || modelLabel())} - ${confidenceFor(bill, "__overall")}% overall confidence</span>
      </div>
      <div class="header-fill"></div>
      <span class="status-pill" style="color:${status.color};background:${status.bg}">
        ${flagged ? `${status.label} - ${evaluatedBill.flags.length} issue${evaluatedBill.flags.length === 1 ? "" : "s"}` : status.label}
      </span>
      <button class="rerun-button" id="rerun-analysis" type="button">Re-run</button>
    </div>

    <div class="content-grid">
      <div class="source-column">${renderPaper(bill)}</div>
      <div class="analysis-column">
        <div class="verdict ${flagged ? "flagged" : "eligible"}">
          <div class="verdict-icon">${flagged ? "!" : "OK"}</div>
          <div>
            <h2>${flagged ? "Flagged for review" : "Eligible"}</h2>
            <p>${
              flagged
                ? `Fails ${evaluatedBill.flags.length} of ${parsedRuleCount} active eligibility rules`
                : `Passes all ${parsedRuleCount} active eligibility rules`
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
          </div>
        </div>

        <div class="section-heading">
          <span>Extracted data</span>
          <button class="link-button" id="edit-fields" type="button">Edit fields</button>
        </div>
        <div class="field-stack">${renderFields(bill)}</div>
      </div>
    </div>
  `;
}

function renderRulePreview() {
  const chips = parseRules(state.rulesText).map((rule) => {
    if (!rule.ok) {
      const snippet = rule.raw.length > 26 ? `${rule.raw.slice(0, 26)}...` : rule.raw;
      return `<span class="chip warn">Unclear: ${escapeHtml(snippet)}</span>`;
    }
    if (rule.kind === "required") {
      return `<span class="chip ok">Require ${escapeHtml(rule.fields.map(fieldLabel).join(" + "))}</span>`;
    }
    return `<span class="chip warn">Exclude "${escapeHtml(rule.keywords.join(" / "))}"</span>`;
  });
  elements.rulePreview.innerHTML = chips.join("");
}

function renderExtractPreview() {
  const extract = parseExtract(state.extractText);
  const keys = extract.keys.length ? extract.keys : ALL_KEYS;
  const chips = keys.map((key) => `<span class="chip ok">${escapeHtml(FIELD_META[key]?.label || key)}</span>`);
  const unmatched = extract.unmatched.map((raw) => `<span class="chip warn">? ${escapeHtml(raw)}</span>`);
  elements.extractPreview.innerHTML = [...chips, ...unmatched].join("");
}

function renderDrawer(evaluated) {
  elements.drawerBackdrop.classList.toggle("hidden", !state.rulesOpen);
  elements.rulesDrawer.classList.toggle("hidden", !state.rulesOpen);
  elements.rulesText.value = state.rulesText;
  elements.extractText.value = state.extractText;
  updateDrawerCounts(evaluated);
  renderRulePreview();
  renderExtractPreview();
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
  const pages = [...files];
  const firstName = pages[0]?.name || "uploaded-bill.pdf";
  const newBill = {
    id: `u${state.uid++}`,
    fileName: pages.length === 1 ? firstName : `${firstName} + ${pages.length - 1} page(s)`,
    status: "processing",
    pageCount: pages.length,
  };
  state.bills = [newBill, ...state.bills];
  state.selectedId = newBill.id;
  state.dragging = false;
  render();
  await analyzeBill(newBill.id, pages);
}

function addSampleBatch() {
  const sampleFiles = [{ name: "batch-scan-01.jpg" }, { name: "batch-scan-02.pdf" }, { name: "batch-scan-03.png" }];
  const newBills = sampleFiles.map((file) => ({
    id: `u${state.uid++}`,
    fileName: file.name,
    status: "processing",
  }));
  state.bills = [...newBills, ...state.bills];
  state.selectedId = newBills[0].id;
  render();
  newBills.forEach((bill, index) => {
    window.setTimeout(() => resolveBill(bill.id), 900 + index * 650);
  });
}

async function analyzeBill(id, pages) {
  const formData = new FormData();
  pages.forEach((page) => formData.append("pages", page, page.name));
  formData.append("rulesText", state.rulesText);
  formData.append("extractText", state.extractText);
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
            ...payload.bill,
            fileName: payload.fileName || bill.fileName,
            pageCount: payload.pageCount || bill.pageCount,
            modelUsed: payload.model,
            status: "done",
          }
        : bill
    );
    render();
    flash(`Analyzed ${payload.pageCount || pages.length} page${(payload.pageCount || pages.length) === 1 ? "" : "s"} with OpenAI`);
  } catch (error) {
    state.bills = state.bills.map((bill) =>
      bill.id === id ? { ...bill, status: "error", error: error.message || "OpenAI analysis failed." } : bill
    );
    render();
    flash("OpenAI analysis failed");
  }
}

function resolveBill(id) {
  const data = state.uploadPool[state.poolIdx % state.uploadPool.length];
  state.poolIdx += 1;
  state.bills = state.bills.map((bill) => (bill.id === id ? { ...bill, ...data, status: "done" } : bill));
  render();
}

function exportCsv() {
  const bills = evaluatedBills().filter((bill) => bill.status !== "processing" && bill.status !== "error");
  const extract = parseExtract(state.extractText);
  const columns = extract.keys.length ? extract.keys : ALL_KEYS;
  const header = ["File", ...columns.map((key) => FIELD_META[key].label), "Eligibility", "Flags", "Model"];
  const rows = [header];

  bills.forEach((bill) => {
    const cells = columns.map((key) => {
      if (key === "servicesText") return servicesFor(bill).join("; ");
      if (key === "totalCost" || key === "discounts") return money(bill[key]);
      return bill[key] || "";
    });
    rows.push([
      bill.fileName,
      ...cells,
      bill.flags.length ? "Flagged" : "Eligible",
      bill.flags.map((flag) => flag.label).join(" | "),
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
    state.model = button.dataset.model;
    state.modelMenuOpen = false;
    render();
    flash(`Re-analyzing with ${modelLabel()}...`);
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

  elements.sampleBatch.addEventListener("click", () => {
    addSampleBatch();
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
    const button = event.target.closest("[data-bill]");
    if (!button) return;
    state.selectedId = button.dataset.bill;
    render();
  });

  elements.detailPane.addEventListener("click", (event) => {
    if (event.target.closest("#rerun-analysis")) {
      flash("Re-ran eligibility analysis");
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
      bill.id === state.selectedId ? { ...bill, [field]: event.target.value } : bill
    );
    render();
  });

  elements.rulesText.addEventListener("input", (event) => {
    state.rulesText = event.target.value;
    const evaluated = evaluatedBills();
    renderRulePreview();
    updateDrawerCounts(evaluated);
    renderFilters(evaluated);
    renderBillList(evaluated);
    renderDetail(evaluated);
  });

  elements.extractText.addEventListener("input", (event) => {
    state.extractText = event.target.value;
    renderExtractPreview();
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

