// import { getRoleById } from "../../modules/users/users.model.js";

// export function requireRole(role) {
  
//   return async (req, res, next) => {
//     try {
//       if (!req.user || !req.user.id) {
//         return res.status(401).json({ success: false, message: "Unauthorized" });
//       }

//       // If getRoleById is async, add await here: await getRoleById(req.user.id)
//       const userRole = await getRoleById(req.user.id); 

//       if (!userRole || userRole.role !== role) {
//         return res.status(403).json({
//           success: false,
//           message: `Forbidden: Requires ${role} role`,
//         });
//       }

//       next(); // Role matched, proceed to getAllUserController
//     } catch (error) {
//       next(error);
//     }
//   };
// }

// export default requireRole;


import { getRoleById } from "../../modules/users/users.model.js";

/**
 * Middleware factory to authorize user roles.
 * Accepts multiple role arguments: requireRole("admin", "doctor")
 */
export function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const userRole = await getRoleById(req.user.id);

      // Check if the user's role is included in the allowed roles
      // Handles both string return ("admin") and object return ({ role: "admin" })
      const actualRole = typeof userRole === "object" ? userRole?.role : userRole;

      if (!actualRole || !allowedRoles.includes(actualRole)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Requires one of the following roles: [${allowedRoles.join(", ")}]`,
        });
      }

      next(); // Role matched, proceed
    } catch (error) {
      next(error);
    }
  };
}

export default requireRole;