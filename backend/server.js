// server.js

import 'dotenv/config';
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }),
);

app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.removeHeader('Content-Security-Policy');
  next();
});

app.disable('x-powered-by');

if (process.env.NODE_ENV === 'development') {
  const morgan = await import('morgan');
  app.use(morgan.default('dev'));
}

app.use('/public/image', express.static(path.join(__dirname, 'public/images')));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.set('trust proxy', true);
app.use(express.json({ limit: '1000mb' }));
app.use(express.urlencoded({ limit: '1000mb', extended: true }));
app.use(cookieParser());

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://192.168.166.80:3001',
  'https://osm.digiindiasolutions.com',
  'https://osmapi.digiindiasolutions.com',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.startsWith('blob:')
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  }),
);

// ✅ STATIC FILES - Serve uploads folder
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ✅ ALSO serve checked-sheets directly (for database URLs without /uploads/)
app.use(
  '/checked-sheets',
  express.static(path.join(process.cwd(), 'uploads', 'checked-sheets')),
);

// ✅ Serve backups
app.use('/backups', express.static(path.join(process.cwd(), 'backups')));

// Import routes
import adminRouter from './src/admin/admin-routes.js';
import companyRouter from './src/system-settings/company/company-routes.js';
import dashboardRouter from './src/dashboard/dashboard-routes.js';
import reportsRouter from './src/reportsTab/reportTabRoutes.js';
import hashRouter from './src/admin/hash.routes.js';
import examManagemantRouter from './src/exam-management/exam-management-routes.js';
import markSchemeRouter from './src/mark-scheme/mark-scheme-routes.js';
import settingRoutes from './src/setting/settingRoutes.js';
import subjectRoutes from './src/Subject/subjectRoutes.js';
import StudentRoutes from './src/students/studentRoutes.js';
import Sheetupload from './src/sheetupload/sheetRoutes.js';
import assignmentRoutes from './src/assignment/assignmentRoutes.js';
import workQueueRoutes from './src/work-queue/workRoutes.js';
import recheckRoutes from './src/recheck-queue/recheckRoute.js';
import MarkscheckerRoutes from './src/checker-marking-controller/checkerMarkingRoutes.js';
import TeacherRoutes from './src/teacherController/teacherRoutes.js';
import AdminDashboardRoutes from './src/adminDashboard/adminDashboardROute.js';
import recheckReportRoutes from './src/reportsTab/recheck/recheckReportsROutes.js';
import checkerPerformanceRoutes from './src/reports/checkerPerformanceController/checkerPerformanceRoutes.js';

// Routes
app.use('/api/v1/results', reportsRouter);
app.use('/api/v1/recheck-report', recheckReportRoutes);
app.use('/api/v1/checker-performance', checkerPerformanceRoutes);
app.use('/api/v1/adminDashboard', AdminDashboardRoutes);
app.use('/api/v1/auth', adminRouter);
app.use('/api/v1/hash', hashRouter);
app.use('/api/v1/setting', settingRoutes);
app.use('/api/v1/auth', subjectRoutes);
app.use('/api/v1/company', companyRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/exam', examManagemantRouter);
app.use('/api/v1/mark-scheme', markSchemeRouter);
app.use('/api/v1/work-queue', workQueueRoutes);
app.use('/api/v1/Students', StudentRoutes);
app.use('/api/v1/sheets', Sheetupload);
app.use('/api/v1/assignments', assignmentRoutes);
app.use('/api/v1/recheck-queue', recheckRoutes);
app.use('/api/v1/checker', MarkscheckerRoutes);
app.use('/api/v1/teacher', TeacherRoutes);

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.get('/developer', (req, res) => {
  res.send('<h1>Server of AASIB KHAN</h1>');
});

const port = process.env.PORT || 7000;
app.listen(port, '127.0.0.1', () => {
  console.log({ message: `App is running on port ${port}` });
});
