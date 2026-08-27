import { Router } from "express";
import multer from "multer";
import { listScheduledHandler, listSentHandler, getEmailByIdHandler, deleteEmailHandler, archiveEmailHandler } from "../controllers/emailController";
import { parseRecipientsHandler } from "../controllers/parseRecipientsController";

const router = Router();

// GET /api/emails/scheduled?page=1&limit=20&senderId=cuid&order=desc
router.get("/emails/scheduled", listScheduledHandler);

// GET /api/emails/sent?page=1&limit=20&senderId=cuid&order=desc
router.get("/emails/sent", listSentHandler);

// GET /api/emails/:id - detail for show view
router.get("/emails/:id", getEmailByIdHandler);
router.delete("/emails/:id", deleteEmailHandler);
router.post("/emails/:id/archive", archiveEmailHandler);

// CSV upload — 2MB limit, memory storage, single field "file"
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    // Accept text/csv and fallback to .csv/.txt extension check
    const ok = /^(text\/(csv|plain)|application\/csv|application\/octet-stream)$/.test(file.mimetype) ||
      /\.(csv|txt)$/i.test(file.originalname);
    if (!ok) return cb(new Error(`Unsupported file type ${file.mimetype}. Use .csv or .txt`));
    cb(null, true);
  },
});

router.post("/parse-recipients", upload.single("file"), parseRecipientsHandler);

export default router;
