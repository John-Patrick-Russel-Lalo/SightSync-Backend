import 'dotenv/config';
import express from "express";
import session from "express-session";
import passport from "./shared/config/passport.js";
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/users.routes.js";
import lensRoutes from "./modules/lenses/lenses.routes.js";
import patientRoutes from "./modules/patient_management/patient.routes.js";

import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cookieParser());


const allowedOrigins = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://localhost:5173",
  "http://localhost:5174",
]

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
);


app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/lenses", lensRoutes);
app.use("/patients", patientRoutes);
export default app;