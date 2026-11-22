import jwt from "jsonwebtoken";

export function createAuthMiddleware(roles = ["USER"]) {
    return function authMiddleware(req, res, next) {
        const token =
            req.cookies?.token || req.headers.authorization?.split(" ")[1] || req.headers.authorisation?.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                error: { message: "Unauthorized! Token not found" },
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userRole = decoded.role || decoded.roles;
            const normalizedAllowed = roles.map((r) => String(r).toUpperCase());

            if (!userRole || !normalizedAllowed.includes(String(userRole).toUpperCase())) {
                return res.status(403).json({
                    success: false,
                    error: {
                        message: "Forbidden! You do not have permission to access this resource",
                    },
                });
            }

            req.user = decoded;
            next();
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: { message: "Unauthorized! Invalid token" },
            });
        }
    };
}
