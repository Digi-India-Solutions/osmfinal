import "dotenv/config";
import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
// import { connectDB } from "./Db/index.js";
import morgan from "morgan";
import helmet from "helmet";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ===== Security headers (SAFE CONFIG) =====
app.use(
  helmet({
    crossOriginResourcePolicy: false, // IMPORTANT for uploads & admin
  })
);
app.disable("x-powered-by");



if (process.env.NODE_ENV === "development") {
  const morgan = await import("morgan");
  app.use(morgan.default("dev"));
}

app.use("/public/image", express.static(path.join(__dirname, "public/images")));
app.use("/public", express.static(path.join(__dirname, "public")));

app.set("trust proxy", true);
app.use(express.json({ limit: "1000mb" }));
app.use(express.urlencoded({ limit: "1000mb", extended: true }));
app.use(cookieParser());
// app.use(morgan("dev"));

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3000/",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://192.168.166.80:3001",

];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));


// connectDB();

import adminRouter from "./src/admin/admin-routes.js";
import companyRouter from "./src/system-settings/company/company-routes.js";
import dashboardRouter from "./src/dashboard/dashboard-routes.js";
import reportsRouter from "./src/reports/reports-routes.js";
import hashRouter from './src/admin/hash.routes.js';
import examManagemantRouter from './src/exam-management/exam-management-routes.js';
import markSchemeRouter from "./src/mark-scheme/mark-scheme-routes.js"
import settingRoutes from './src/setting/settingRoutes.js'; 
import subjectRoutes from './src/Subject/subjectRoutes.js';
import StudentRoutes from './src/students/studentRoutes.js';
import Sheetupload from './src/sheetupload/sheetRoutes.js';
import assignmentRoutes from './src/assignment/assignmentRoutes.js';
import workQueueRoutes from './src/work-queue/workRoutes.js';
import recheckRoutes from './src/recheck-queue/recheckRoute.js';
app.use('/backups', express.static(path.join(process.cwd(), 'backups')));
app.use("/api/v1/reports", reportsRouter);
app.use("/api/v1/auth", adminRouter);
app.use('/api/v1/hash', hashRouter);
app.use('/api/v1/setting', settingRoutes);
app.use('/api/v1/auth', subjectRoutes);
app.use("/api/v1/company", companyRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/exam", examManagemantRouter);
app.use("/api/v1/mark-scheme", markSchemeRouter);
app.use('/api/v1/work-queue', workQueueRoutes);
app.use("/api/v1/Students", StudentRoutes);
app.use('/api/v1/sheets', Sheetupload);
app.use('/api/v1/assignments', assignmentRoutes);
app.use('/api/v1/recheck-queue', recheckRoutes);

app.get("/", (req, res) => {
  res.send("Server is running");
});



app.get("/developer", (req, res) => {
  res.send(
    `<h1>It is great to see you on the server of <a href="https://www.linkedin.com/in/nitin-gupta-b7a9a02a1/">AASIB KHAN</a></h1>`
  );
});



const port = process.env.PORT || 7000;
app.listen(port, "127.0.0.1", () => {
  console.log({ message: `App is running on port ${port}` });
});

