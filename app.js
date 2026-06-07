import 'dotenv/config';
import express from "express";
import session from "express-session";
import passport from "./shared/config/passport.js";
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/users.routes.js";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cookieParser());


app.use(
  cors({
    origin: "http://localhost:5500",
    credentials: true
  })
);


app.use("/auth", authRoutes);
app.use("/users", userRoutes);

export default app;