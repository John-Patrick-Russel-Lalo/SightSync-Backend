import 'dotenv/config';
import express from "express";
import session from "express-session";
import passport from "./shared/config/passport.js";
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/users.routes.js";
import lensRoutes from "./modules/lenses/lenses.routes.js";
import patientRoutes from "./modules/patient_management/patient.routes.js";
import aiRoutes from "./modules/ai/ai.routes.js";
import appointmentRoutes from "./modules/appointment_management/appointment.routes.js";
import doctorRoutes from "./modules/doctor_management/doctor.routes.js";
import inventoryRoutes from "./modules/inventory/inventory.routes.js";
import posRoutes from "./modules/pos/pos.routes.js";
import notificationRoutes from "./modules/notification/notification.routes.js";

import { startAppointmentCron } from "./shared/services/appointmentCron.js";
startAppointmentCron();

import { startDoctorStatusBroadcast } from "./modules/doctor_management/doctorStatus.service.js";
startDoctorStatusBroadcast();

import cookieParser from "cookie-parser";
import cors from "cors";
import { corsOptions } from "./shared/config/cors.js";

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use(cors(corsOptions));


app.use("/health", (req, res) => {
    res.json({ message: "OK" });
});
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/lenses", lensRoutes);
app.use("/patients", patientRoutes);
app.use("/ai", aiRoutes);
app.use("/appointments", appointmentRoutes);
app.use("/doctors", doctorRoutes);
app.use("/inventory", inventoryRoutes);
app.use("/pos", posRoutes);
app.use("/notifications", notificationRoutes);


export default app;