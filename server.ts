import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

const DATA_FILE = path.join(process.cwd(), "data.json");

// Fully clean default template data with empty transactions and no mock trade records
const defaultData = {
  settings: {
    shops: [],
    persons: [],
    coins: [
      { name: "سکه بهار آزادی (امامی)", weight: 8.133 },
      { name: "نیم سکه بهار آزادی", weight: 4.066 },
      { name: "ربع سکه بهار آزادی", weight: 2.033 },
      { name: "سکه گرمی", weight: 1.012 },
      { name: "سکه پارسیان", weight: 1.000 }
    ],
    currentGoldPrice: 35000000, // 35 Million Rail baseline price
    spreadsheetId: ""
  },
  transactions: []
};

// Ensure database file exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), "utf8");
}

// REST endpoints for local database handling
app.get("/api/data", (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const rawData = fs.readFileSync(DATA_FILE, "utf8");
      res.json(JSON.parse(rawData));
    } else {
      res.json(defaultData);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to read database file." });
  }
});

app.post("/api/data", (req, res) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2), "utf8");
    res.json({ success: true, data: req.body });
  } catch (error) {
    res.status(500).json({ error: "Failed to update database file." });
  }
});

// Setup Vite & Static HTML fallbacks
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

start();
