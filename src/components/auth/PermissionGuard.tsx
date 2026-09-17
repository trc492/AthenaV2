// src/components/auth/PermissionGuard.tsx
"use client";

import { useSession } from "next-auth/react";
import { ReactNode } from "react";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasAnyRole,
} from "@/lib/auth/roles";

interface PermissionGuardProps {
  children: ReactNode;
  permission?: string;
  permissions?: string[];
  roles?: string[] | null; // Optional array of roles to check against
  requireAll?: boolean; // If true, user must have ALL permissions; if false, user must have ANY
  fallback?: ReactNode;
  showIfUnauthorized?: boolean; // If true, shows children even if unauthorized (useful for conditional styling)
}

export function PermissionGuard({
  children,
  permission,
  permissions,
  roles,
  requireAll = false,
  fallback = null,
  showIfUnauthorized = false,
}: PermissionGuardProps) {
  const { data: session } = useSession();
  const userRole = session?.user?.role || null;

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(userRole, permission);
  } else if (permissions) {
    hasAccess = requireAll
      ? hasAllPermissions(userRole, permissions)
      : hasAnyPermission(userRole, permissions);
  } else if (roles) {
    hasAccess = hasAnyRole(userRole, roles);
  } else {
    // If no permission specified, allow access
    hasAccess = true;
  }

  if (hasAccess || showIfUnauthorized) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
