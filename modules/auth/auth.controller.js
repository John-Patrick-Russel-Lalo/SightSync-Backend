import { createUser, loginUser, findUserByEmail } from "./auth.model.js";
import jwt from "jsonwebtoken";

export async function register(req, res) {
  try {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const firstName = String(req.body.firstName ?? "").trim();
    const lastName = String(req.body.lastName ?? "").trim();
    const password = String(req.body.password ?? "").trim();

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const username = `${firstName} ${lastName}`.trim();

    const user = await createUser(email, username, password);

    const { password: _password, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function login(req, res) {
  try {
    const email = String(req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "").trim();

    const user = await loginUser(email, password);

    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    const { password: _password, ...safeUser } = user;
    res.status(200).json({ user: safeUser, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export default { register, login };
