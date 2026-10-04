const allowedOrigins = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://sightsync-chi.vercel.app",
];

export const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
};

export default allowedOrigins;
