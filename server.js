import express from "express";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db.js";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash-preview-05-20";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    console.log(`Received file '${file.originalname}' with MIME type: ${file.mimetype}`);

    const allowedMimeTypes = [
      "text/plain", "text/javascript", "application/javascript", "text/x-python",
      "application/json", "text/html", "text/css", "text/x-java-source", "text/markdown",
      "text/x-c++src", "text/x-csrc", "text/x-csharp", "text/x-go", "text/x-ruby",
      "application/x-httpd-php", "text/x-swift", "text/x-kotlin", "text/rust",
      "application/xml", "text/xml", "application/x-yaml", "text/yaml",
      "application/x-sh", "application/typescript", "text/jsx", "text/tsx",
      "application/octet-stream"
    ];
    
    const allowedExtensions = [
        '.txt', '.js', '.py', '.json', '.html', '.css', '.java', '.md', 
        '.cpp', '.c', '.cs', '.go', '.rb', '.php', '.swift', '.kt', '.rs', 
        '.xml', '.yaml', '.sh', '.ts', '.jsx', '.tsx'
    ];

    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only code and text files are allowed."), false);
    }
  },
});

const deleteTempFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting temporary file:", err);
    });
  }
};

const callGeminiApi = async (payload) => {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set in environment variables.");

  const MAX_RETRIES = 5;
  const API_URL_WITH_KEY = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await fetch(API_URL_WITH_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        const report = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!report) throw new Error("Gemini API returned an empty or invalid response.");
        return report;
      } else {
        const errorBody = await response.json().catch(() => ({}));
        console.error(`Attempt ${i + 1} failed with status: ${response.status}`, errorBody);
        if (response.status >= 500 && i < MAX_RETRIES - 1) {
          const delay = Math.pow(2, i) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`Gemini API Error: ${response.status} ${errorBody.error?.message || response.statusText}`);
      }
    } catch (err) {
      console.error(`Attempt ${i + 1} failed due to network or other error:`, err.message);
      if (i === MAX_RETRIES - 1) throw err;
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Gemini API call failed after multiple retries.");
};

app.post("/api/analyze", (req, res, next) => {
    const uploader = upload.single("file");
    uploader(req, res, (err) => {
        if (err instanceof multer.MulterError) return res.status(400).json({ error: `File upload error: ${err.message}` });
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res) => {
    try {
        const { prompt: userPrompt } = req.body;
        if (!req.file) return res.status(400).json({ error: "A code file is required." });
        if (!userPrompt) return res.status(400).json({ error: "A review prompt is required." });

        const code = fs.readFileSync(req.file.path, "utf8");
        const fullPrompt = `Please act as an expert code reviewer. Review the following code file and provide a structured report.\n\nUser's Instructions: "${userPrompt}"\n\nFile Name: ${req.file.originalname}\n\n---\n\n\`\`\`\n${code}\n\`\`\`\n\n---\n\nYour report should include sections for potential bugs, suggestions for improvement (like performance, readability, and best practices), and an overall assessment.`;
        
        const payload = {
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { temperature: 0.2 },
        };

        const report = await callGeminiApi(payload);

        const dbResult = await pool.query(
            "INSERT INTO reviews (filename, review_prompt, report) VALUES ($1, $2, $3) RETURNING id, filename, created_at",
            [req.file.originalname, userPrompt, report]
        );

        res.status(201).json({
            message: "Analysis successful!",
            review: { ...dbResult.rows[0], prompt: userPrompt, report },
        });
    } catch (error) {
        console.error("Error during code analysis:", error.message);
        res.status(500).json({ error: "An internal server error occurred during the analysis." });
    } finally {
        if (req.file) deleteTempFile(req.file.path);
    }
});

app.get("/api/reports", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, filename, review_prompt, created_at FROM reviews ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching reports list:", error.message);
    res.status(500).json({ error: "Failed to fetch reports from the database." });
  }
});

app.get("/api/reports/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM reviews WHERE id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: `Report with ID ${id} not found.` });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Error fetching report ID ${req.params.id}:`, error.message);
    res.status(500).json({ error: "Failed to fetch the specified report." });
  }
});

app.delete("/api/reports/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM reviews WHERE id = $1 RETURNING id", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: `Report with ID ${id} not found.` });
    res.status(204).end();
  } catch (error) {
    console.error(`Error deleting report ID ${req.params.id}:`, error.message);
    res.status(500).json({ error: "Failed to delete the report." });
  }
});

app.listen(port, () => {
  console.log(`\n✅ Server is running. Access the frontend at http://localhost:${port}`);
  console.log(`   - LLM Model in use: ${GEMINI_MODEL}`);
});

