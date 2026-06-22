import "dotenv/config";

import path from "node:path";
import express from "express";
import multer from "multer";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const PORT = Number(process.env.PORT || 4173);
const MAX_PAGES = Number(process.env.MAX_BILL_PAGES || 12);
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE_BYTES || 12 * 1024 * 1024);
const FALLBACK_MODEL_ID = process.env.OPENAI_MODEL || "gpt-5.5";
const MODELS = parseModelOptions(process.env.OPENAI_MODEL_OPTIONS, FALLBACK_MODEL_ID);
const DEFAULT_MODEL = chooseDefaultModel(process.env.OPENAI_MODEL, MODELS);

const app = express();
const ROOT = process.cwd();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_PAGES,
  },
  fileFilter(_req, file, cb) {
    if (file.mimetype === "application/pdf" || file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only PDF and image files are supported."));
  },
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ConfidenceScore = z
  .number()
  .min(0)
  .max(100)
  .describe("Evidence-based confidence percentage from 0 to 100. Use 60 for sixty percent, not 0.6.");

const ExtractedField = z.object({
  label: z.string(),
  value: z.string(),
  confidence: ConfidenceScore,
});

const RuleEvaluation = z.object({
  rule: z.string().describe("The eligibility rule exactly as the reviewer wrote it."),
  passed: z.boolean().describe("True when the bill satisfies the reviewer-provided rule; false when it violates the rule."),
  detail: z.string().describe("Brief evidence from the bill explaining the result."),
  confidence: ConfidenceScore,
});

const FieldConfidences = z.object({
  patientName: ConfidenceScore,
  providerName: ConfidenceScore,
  providerAddress: ConfidenceScore,
  dateOfService: ConfidenceScore,
  servicesText: ConfidenceScore,
  totalCost: ConfidenceScore,
  discounts: ConfidenceScore,
});

const BillAnalysis = z.object({
  patientName: z.string(),
  providerName: z.string(),
  providerAddress: z.string(),
  dateOfService: z.string(),
  servicesText: z.string(),
  totalCost: z.string(),
  discounts: z.string(),
  fieldConfidences: FieldConfidences.describe("Confidence for each canonical extracted field. Use 0 when a field is not visible."),
  extractedFields: z.array(ExtractedField).describe("One entry for every requested field label, including custom fields such as Tax collected."),
  ruleEvaluations: z.array(RuleEvaluation).describe("One model-produced pass/fail evaluation for every non-empty eligibility rule line supplied by the reviewer."),
  confidence: ConfidenceScore.describe("Overall extraction confidence as a percentage from 0 to 100."),
  notes: z.string(),
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

app.get("/index.html", (_req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

app.get("/styles.css", (_req, res) => {
  res.sendFile(path.join(ROOT, "styles.css"));
});

app.get("/app.js", (_req, res) => {
  res.sendFile(path.join(ROOT, "app.js"));
});

app.get("/api/config", (_req, res) => {
  res.json({
    model: DEFAULT_MODEL.id,
    models: MODELS,
    maxPages: MAX_PAGES,
    maxFileSize: MAX_FILE_SIZE,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.post("/api/analyze-bill", upload.array("pages", MAX_PAGES), async (req, res, next) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
      return;
    }

    const pages = req.files || [];
    if (!pages.length) {
      res.status(400).json({ error: "Upload at least one bill document." });
      return;
    }

    const rulesText = String(req.body.rulesText || "").trim();
    const extractText = String(req.body.extractText || "").trim();
    const requestedModel = String(req.body.model || "").trim();
    const selectedModel = modelById(requestedModel) || DEFAULT_MODEL;
    const pageNames = pages.map((file) => file.originalname).join(", ");

    const content = [
      {
        type: "input_text",
        text: [
          "You are extracting structured data from one medical bill document. The uploaded document may contain multiple pages.",
          "Read the entire document as one bill, not as separate claims.",
          "Return empty strings for fields that are not visible.",
          "Use ISO YYYY-MM-DD for dateOfService when possible.",
          "For servicesText, put one service or line item per line and include bill line items relevant to the eligibility rules.",
          "For totalCost and discounts, return numeric strings without currency symbols.",
          "For extractedFields, return one entry for every requested field label exactly as written. Include custom fields such as Tax collected, subtotal, invoice number, or any other line the reviewer requested.",
          "For fieldConfidences and extractedFields.confidence, return only evidence-based confidence percentages from 0 to 100. Use 0 when the field is not visible. Do not invent confidence values for fields that were not extracted from the document.",
          "For ruleEvaluations, evaluate every non-empty eligibility rule line supplied by the reviewer exactly as written. Return passed=false when the bill violates that rule and include the visible evidence in detail.",
          "Apply only the reviewer-provided rules. Do not invent extra coverage rules, benefit rules, or medical policy rules.",
          "",
          `Uploaded document filename: ${pageNames}`,
          "",
          "Eligibility rules currently configured by the reviewer:",
          rulesText || "(none)",
          "",
          "Fields requested by the reviewer:",
          extractText || "(default bill fields)",
        ].join("\n"),
      },
      ...pages.map(fileToOpenAIContent),
    ];

    const response = await openai.responses.parse({
      model: selectedModel.id,
      input: [
        {
          role: "system",
          content:
            "You extract medical bill eligibility review fields and apply only the reviewer-provided eligibility rules to the visible bill evidence. Do not invent independent medical coverage decisions or policy rules.",
        },
        {
          role: "user",
          content,
        },
      ],
      text: {
        format: zodTextFormat(BillAnalysis, "bill_analysis"),
      },
    });

    const parsed = response.output_parsed;
    res.json({
      bill: {
        patientName: parsed.patientName || "",
        providerName: parsed.providerName || "",
        providerAddress: parsed.providerAddress || "",
        dateOfService: parsed.dateOfService || "",
        servicesText: parsed.servicesText || "",
        totalCost: parsed.totalCost || "",
        discounts: parsed.discounts || "",
        fieldConfidences: normalizeConfidenceMap(parsed.fieldConfidences),
        extractedFields: normalizeExtractedFields(parsed.extractedFields),
        ruleEvaluations: normalizeRuleEvaluations(parsed.ruleEvaluations),
        confidence: normalizeConfidence(parsed.confidence),
        notes: parsed.notes || "",
      },
      model: selectedModel.id,
      pageCount: pages.length,
      fileName: pages.length === 1 ? pages[0].originalname : `${pages[0].originalname} + ${pages.length - 1} page(s)`,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const status = message.includes("Only PDF") || message.includes("File too large") ? 400 : 500;
  console.error(message);
  res.status(status).json({ error: message });
});

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const percent = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, percent));
}

function normalizeConfidenceMap(values = {}) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, normalizeConfidence(value)])
  );
}

function normalizeExtractedFields(fields = []) {
  if (!Array.isArray(fields)) return [];
  return fields.map((field) => ({
    label: String(field.label || ""),
    value: String(field.value || ""),
    confidence: normalizeConfidence(field.confidence),
  }));
}

function normalizeRuleEvaluations(evaluations = []) {
  if (!Array.isArray(evaluations)) return [];
  return evaluations.map((evaluation) => ({
    rule: String(evaluation.rule || ""),
    passed: Boolean(evaluation.passed),
    detail: String(evaluation.detail || ""),
    confidence: normalizeConfidence(evaluation.confidence),
  }));
}
function fileToOpenAIContent(file) {
  const base64 = file.buffer.toString("base64");
  if (file.mimetype.startsWith("image/")) {
    return {
      type: "input_image",
      image_url: `data:${file.mimetype};base64,${base64}`,
    };
  }

  return {
    type: "input_file",
    filename: file.originalname,
    file_data: `data:${file.mimetype};base64,${base64}`,
  };
}

function parseModelOptions(raw, fallbackModelId) {
  const rows = String(raw || "")
    .split(";")
    .map((row) => row.trim())
    .filter(Boolean);

  const parsed = rows
    .map((row) => {
      const [id, meta = ""] = row.split("|").map((part) => part.trim());
      if (!id) return null;
      return {
        id,
        meta,
      };
    })
    .filter(Boolean);

  if (parsed.length) return parsed;
  return [
    {
      id: fallbackModelId,
      meta: "Configured by OPENAI_MODEL",
    },
  ];
}

function chooseDefaultModel(id, models) {
  return modelById(id, models) || models[0];
}

function modelById(id, models = MODELS) {
  return models.find((model) => model.id === id);
}

app.listen(PORT, () => {
  console.log(`Veris Claims Eligibility running at http://localhost:${PORT}`);
});
