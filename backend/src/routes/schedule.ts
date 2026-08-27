import { Router } from "express";
import { scheduleHandler } from "../controllers/scheduleController";

const router = Router();

router.post("/schedule", scheduleHandler);

export default router;
