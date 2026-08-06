import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// متغیرهای محلی (.env.local) را بخوان تا رفتار لوکال شبیه ورسل قابل تست باشد.
// روی ورسل، متغیرها از تنظیمات پروژه می‌آیند و این فایل وجود ندارد.
dotenv.config({ path: ".env.local" });

const { default: authHandler } = await import("./api/auth.js");
const { default: dataHandler } = await import("./api/data.js");
const { USE_BLOB } = await import("./api/_lib/core.js");

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// همان توابعی که روی ورسل به صورت serverless اجرا می‌شوند، اینجا هم استفاده
// می‌شوند تا رفتار محیط توسعه دقیقاً مثل محیط واقعی باشد.
app.all("/api/auth", (req, res) => authHandler(req as any, res as any));
app.all("/api/data", (req, res) => dataHandler(req as any, res as any));

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
    console.log(
      USE_BLOB
        ? "ذخیره‌سازی: Vercel Blob"
        : "ذخیره‌سازی: پوشه محلی .data/ (روی ورسل متغیر BLOB_READ_WRITE_TOKEN لازم است)"
    );
  });
}

start();
