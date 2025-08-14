/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Provides fine-grained access control for validation system endpoints
 * with role hierarchies and permission-based authorization.
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage.js';

export interface User {
  id: string;
  email?: string;
  role: string;
  permissions?: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export enum UserRole {
  USER = 'user',
  REVIEWER = 'reviewer', 
  ADMIN = 'admin',
  SYSTEM = 'system'
}

export enum Permission {
  // Evidence permissions
  READ_EVIDENCE = 'evidence:read',
  WRITE_EVIDENCE = 'evidence:write',
  DELETE_EVIDENCE = 'evidence:delete',
  
  // Validation permissions
  VALIDATE_PROMOTION = 'validation:execute',
  REVIEW_VALIDATION = 'validation:review',
  OVERRIDE_VALIDATION = 'validation:override',
  
  // Promotion permissions
  READ_PROMOTIONS = 'promotions:read',
  WRITE_PROMOTIONS = 'promotions:write',
  APPROVE_PROMOTIONS = 'promotions:approve',
  
  // System permissions
  MANAGE_USERS = 'users:manage',
  VIEW_LOGS = 'logs:view',
  MANAGE_SYSTEM = 'system:manage',
  
  // Admin permissions
  VIEW_ADMIN = 'admin:view',
  MANAGE_ADMIN = 'admin:manage'
}

/**
 * Role permission mappings
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.USER]: [
    Permission.READ_PROMOTIONS,
  ],
  [UserRole.REVIEWER]: [
    Permission.READ_PROMOTIONS,
    Permission.READ_EVIDENCE,
    Permission.REVIEW_VALIDATION,
    Permission.VIEW_LOGS,
    Permission.VIEW_ADMIN,
  ],
  [UserRole.ADMIN]: [
    Permission.READ_PROMOTIONS,
    Permission.WRITE_PROMOTIONS,
    Permission.APPROVE_PROMOTIONS,
    Permission.READ_EVIDENCE,
    Permission.WRITE_EVIDENCE,
    Permission.VALIDATE_PROMOTION,
    Permission.REVIEW_VALIDATION,
    Permission.OVERRIDE_VALIDATION,
    Permission.MANAGE_USERS,
    Permission.VIEW_LOGS,
    Permission.VIEW_ADMIN,
    Permission.MANAGE_ADMIN,
  ],
  [UserRole.SYSTEM]: [
    // System role has all permissions
    ...Object.values(Permission)
  ]
};

/**
 * Get permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = getRolePermissions(role);
  return permissions.includes(permission);
}

/**
 * Check if a user has a specific permission
 */
export function userHasPermission(user: User, permission: Permission): boolean {
  // Check explicit permissions first
  if (user.permissions && user.permissions.includes(permission)) {
    return true;
  }
  
  // Check role-based permissions
  const userRole = user.role as UserRole;
  return hasPermission(userRole, permission);
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
    return;
  }
  next();
}

/**
 * Middleware to require specific role
 */
export function requireRole(role: UserRole) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    if (req.user.role !== role) {
      res.status(403).json({ 
        success: false, 
        error: `Role '${role}' required` 
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require specific permission
 */
export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    if (!userHasPermission(req.user, permission)) {
      res.status(403).json({ 
        success: false, 
        error: `Permission '${permission}' required` 
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require any of multiple permissions
 */
export function requireAnyPermission(permissions: Permission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    const hasAnyPermission = permissions.some(permission => 
      userHasPermission(req.user!, permission)
    );

    if (!hasAnyPermission) {
      res.status(403).json({ 
        success: false, 
        error: `One of these permissions required: ${permissions.join(', ')}` 
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require admin role (backward compatibility)
 */
export function isAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireRole(UserRole.ADMIN)(req, res, next);
}

/**
 * Middleware to check if user is admin or reviewer
 */
export function isAdminOrReviewer(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
    return;
  }

  const userRole = req.user.role as UserRole;
  if (userRole !== UserRole.ADMIN && userRole !== UserRole.REVIEWER) {
    res.status(403).json({ 
      success: false, 
      error: 'Admin or reviewer role required' 
    });
    return;
  }

  next();
}

/**
 * Middleware to extract user from Clerk auth
 */
export async function extractUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // Check for Clerk user in request (set by Clerk middleware)
    const clerkUser = (req as any).auth?.userId;
    
    if (!clerkUser) {
      // No authentication - continue without user
      next();
      return;
    }

    // Get user from database
    const user = await storage.getUserById(clerkUser);
    
    if (user) {
      req.user = {
        id: user.id,
        email: user.email || undefined,
        role: user.role || UserRole.USER,
      };
    }

    next();
  } catch (error) {
    console.error('Error extracting user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Authentication error' 
    });
  }
}

/**
 * Middleware for validation system endpoints
 */
export const validationAuth = {
  /**
   * Require permission to execute validation
   */
  executeValidation: requirePermission(Permission.VALIDATE_PROMOTION),
  
  /**
   * Require permission to review validation results
   */
  reviewValidation: requirePermission(Permission.REVIEW_VALIDATION),
  
  /**
   * Require permission to override validation
   */
  overrideValidation: requirePermission(Permission.OVERRIDE_VALIDATION),
  
  /**
   * Require permission to read evidence
   */
  readEvidence: requirePermission(Permission.READ_EVIDENCE),
  
  /**
   * Require permission to write evidence
   */
  writeEvidence: requirePermission(Permission.WRITE_EVIDENCE),
  
  /**
   * Require admin access for system management
   */
  manageSystem: requirePermission(Permission.MANAGE_SYSTEM),
  
  /**
   * Require admin or reviewer for viewing validation logs
   */
  viewLogs: requireAnyPermission([Permission.VIEW_LOGS, Permission.MANAGE_ADMIN])
};

/**
 * Get user role hierarchy level (for comparison)
 */
export function getRoleLevel(role: UserRole): number {
  const levels = {
    [UserRole.USER]: 1,
    [UserRole.REVIEWER]: 2,
    [UserRole.ADMIN]: 3,
    [UserRole.SYSTEM]: 4
  };
  return levels[role] || 0;
}

/**
 * Check if user role is at least the required level
 */
export function hasRoleLevel(userRole: UserRole, requiredRole: UserRole): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}

/**
 * Audit log function for permission checks
 */
export function auditPermissionCheck(
  user: User | undefined, 
  permission: Permission, 
  allowed: boolean, 
  resource?: string
): void {
  console.log(`🔐 Permission Check: ${user?.id || 'anonymous'} ${allowed ? '✅' : '❌'} ${permission} ${resource ? `on ${resource}` : ''}`);
}