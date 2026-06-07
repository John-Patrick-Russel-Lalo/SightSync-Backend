import "dotenv/config";
import express from "express";
import passport from "passport";
import { requireAuth } from "../../shared/middleware/authMiddleware.js";
import { requireRole } from "../../shared/middleware/roleMiddleware.js";
import { register, login } from "./auth.controller.js";

import jwt from "jsonwebtoken";

const router = express.Router();

router.get(
  "/github",
  passport.authenticate("github", {
    scope: ["user:email"]
  })
);

router.get(
  "/github/callback",
  passport.authenticate("github", {
    failureRedirect: "http://localhost:5500/index.html",
    session: false
  }),
  (req, res) => {
    console.log("GitHub callback successful, user:", req.user);

    const token = jwt.sign(
      {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
        role: req.user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h"
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none"
    });

    console.log("Generated token:", token);


    res.redirect("http://localhost:5500");
  }
);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "http://localhost:5500/index.html",
    session: false
  }),
  (req, res) => {
    console.log("Google callback successful, user:", req.user);

    const token = jwt.sign(
      {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
        role: req.user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h"
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none"
    });

    console.log("Generated token:", token);

    res.redirect("http://localhost:5500");
  }
);

router.get(
  "/facebook",
  passport.authenticate("facebook", {
    scope: ["email"]
  })
);

router.get(
  "/facebook/callback",
  passport.authenticate("facebook", {
    failureRedirect: "http://localhost:5500/index.html",
    session: false
  }),
  (req, res) => {
    
    console.log("Facebook callback successful, user:", req.user);

    const token = jwt.sign(
      {
        id: req.user.id,
        email: req.user.email,
        username: req.user.display_name,
        role: req.user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h"
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none"
    });

    if (!token) {
      return res.status(500).json({
        message: "Internal server error"
      });
    }
    console.log("Generated token:", token);

    res.redirect("http://localhost:5500");
  }
);


router.post("/register", register);

router.post("/login", login);

router.get("/logout", (req, res) => {

  
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });


  
});


router.get("/me", requireAuth, (req, res) => {

  if (!req.user) {
    return res.status(401).json({
      authenticated: false
    });
  }

  console.log(req.user);

  res.json(req.user);
});



export default router;