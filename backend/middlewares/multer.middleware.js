// src/middlewares/multer.middleware.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ✅ Helper to create folder if not exists
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// ✅ MAIN STORAGE (dynamic based on route)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('file==>>>>>>', file);

    // 🔥 Decide folder dynamically
    let folder = 'others';

    if (file.fieldname === 'logo') {
      folder = 'company';
    } else if (file.fieldname === 'profile_image') {
      folder = 'profile';
    } else if (file.fieldname === 'file') {
      folder = 'students';
    } else if (file.fieldname === 'model_answer_pdf') {
      folder = 'mark-scheme/model-answers';
    } else if (file.fieldname === 'question_paper_pdf') {
      folder = 'mark-scheme/question-papers';
    }

    const uploadPath = path.join(process.cwd(), 'uploads', folder);

    // ✅ Ensure folder exists
    ensureDir(uploadPath);

    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);

    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// ✅ Upload middlewares
export const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

export const uploadImages = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

// ✅ For Excel files (larger limit)
export const uploadExcel = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (
      allowedTypes.includes(file.mimetype) ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls') ||
      file.originalname.endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'), false);
    }
  },
});

// ✅ For PDF files (mark scheme)
export const uploadPDF = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.originalname.endsWith('.pdf')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});
