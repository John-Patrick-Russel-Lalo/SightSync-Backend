
import { getRoleById } from "../../modules/users/users.model.js";
export function requireRole(role, userId) {
  const getRole = getRoleById(userId);
  
  return (req, res, next) => {
    console.log("Checking user role:", req.user ? req.user.role : "No user");
    console.log(getRole);
    if (getRole.role !== role) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Requires ${role} role`,
      });
    }

    next();
  };
}

export default requireRole;