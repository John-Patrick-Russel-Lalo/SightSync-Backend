import { getRoleById } from "../../modules/users/users.model.js";

export function requireRole(role) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      // If getRoleById is async, add await here: await getRoleById(req.user.id)
      const userRole = await getRoleById(req.user.id); 

      if (!userRole || userRole.role !== role) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Requires ${role} role`,
        });
      }

      next(); // Role matched, proceed to getAllUserController
    } catch (error) {
      next(error);
    }
  };
}

export default requireRole;