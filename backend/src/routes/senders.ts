import { Router } from "express";
import { listSendersHandler, createSenderHandler } from "../controllers/senderController";

const router = Router();

router.get("/senders", listSendersHandler);
router.post("/senders", createSenderHandler);

export default router;
