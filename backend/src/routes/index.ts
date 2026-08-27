import { Router } from "express";
import { healthHandler, helloHandler } from "../controllers/healthController";
import scheduleRouter from "./schedule";
import emailsRouter from "./emails";
import authRouter from "./auth";
import sendersRouter from "./senders";

const router = Router();

router.get("/", helloHandler);
router.get("/health", healthHandler);

router.use("/", scheduleRouter);
router.use("/", emailsRouter);
router.use("/", authRouter);
router.use("/", sendersRouter);

export default router;
