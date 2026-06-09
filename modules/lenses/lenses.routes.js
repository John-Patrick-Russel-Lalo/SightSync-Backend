import { fetchAllLenses } from "./lenses.controller.js";
import express from "express";

const router = express.Router();

router.get("/allLenses", fetchAllLenses);

export default router;