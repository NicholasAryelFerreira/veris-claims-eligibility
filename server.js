import "dotenv/config";

import path from "node:path";
import express from "express";
import multer from "multer";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const PORT = Number(process.env.PORT || 4173);
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const MAX_PAGES = Number(process.env.MAX_BILL_PAGES || 12);
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE_BYTES || 12 * 1024 * 1024);

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

const BillAnalysis = z.object({
  patientName: z.string(),
  providerName: z.string(),
  providerAddress: z.string(),
  dateOfService: z.string(),
  servicesText: z.string(),
  totalCost: z.string(),
  discounts: z.string(),
  confidence: z.number().min(0).max(100),
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
    model: MODEL,
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
      res.status(400).json({ error: "Upload at least one bill page." });
      return;
    }

    const rulesText = String(req.body.rulesText || "").trim();
    const extractText = String(req.body.extractText || "").trim();
    const pageNames = pages.map((file) => file.originalname).join(", ");

    const content = [
      {
        type: "input_text",
        text: [
          "You are extracting structured data from one medical bill. The uploaded files may be multiple pages of the same bill.",
          "Read all pages together as one bill, not as separate claims.",
          "Return empty strings for fields that are not visible.",
          "Use ISO YYYY-MM-DD for dateOfService when possible.",
          "For servicesText, put one service or line item per line.",
          "For totalCost and discounts, return numeric strings without currency symbols.",
          "",
          `Uploaded page filenames: ${pageNames}`,
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
      model: MODEL,
      input: [
        {
          role: "system",
          content:
            "You extract medical bill eligibility review fields. Do not make medical coverage decisions; only extract what is visible in the provided bill pages.",
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
        confidence: parsed.confidence,
        notes: parsed.notes || "",
      },
      model: MODEL,
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

app.listen(PORT, () => {
  console.log(`Veris Claims Eligibility running at http://localhost:${PORT}`);
});
