export const ROLES = {
  ADMIN: "admin",
  LEAD_SCOUT: "lead_scout",
  SCOUT: "scout",
  TABLET: "tablet",
  VIEWER: "viewer",
  EXTERNAL: "external",
} as const;

export const PERMISSIONS = {
  // Dashboard & Overview
  VIEW_DASHBOARD: "view_dashboard",
  VIEW_COMMENTS: "view_comments", // We hide this for EXTERNAL users due to GP issues

  // Scouting Operations
  CREATE_MATCH_SCOUTING: "create_match_scouting",
  EDIT_MATCH_SCOUTING: "edit_match_scouting",
  DELETE_MATCH_SCOUTING: "delete_match_scouting",
  VIEW_MATCH_SCOUTING: "view_match_scouting",

  CREATE_PIT_SCOUTING: "create_pit_scouting",
  EDIT_PIT_SCOUTING: "edit_pit_scouting",
  DELETE_PIT_SCOUTING: "delete_pit_scouting",
  VIEW_PIT_SCOUTING: "view_pit_scouting",

  // Picklist Management (Full CRUD)
  VIEW_PICKLIST: "view_picklist",
  CREATE_PICKLIST: "create_picklist",
  EDIT_PICKLIST: "edit_picklist",
  DELETE_PICKLIST: "delete_picklist",

  // Schedule Management (Full CRUD)
  VIEW_SCHEDULE: "view_schedule",
  CREATE_SCHEDULE: "create_schedule",
  EDIT_SCHEDULE: "edit_schedule",
  DELETE_SCHEDULE: "delete_schedule",

  // Event Management
  CONFIGURE_EVENTS: "configure_events",
  MANAGE_EVENT_SETTINGS: "manage_event_settings",

  // Data Management
  EXPORT_DATA: "export_data",
  IMPORT_DATA: "import_data",
  RESET_DATABASE: "reset_database",
  REVALIDATE_CACHE: "revalidate_cache",
  VIEW_DATA_DIAGNOSTICS: "view_data_diagnostics",

  // User Management
  VIEW_USERS: "view_users",
  CREATE_USERS: "create_users",
  EDIT_USERS: "edit_users",
  DELETE_USERS: "delete_users",
  MANAGE_USER_ROLES: "manage_user_roles",

  // System Settings
  VIEW_SETTINGS: "view_settings",
  EDIT_SETTINGS: "edit_settings",
  MANAGE_SYSTEM_CONFIG: "manage_system_config",

  // Advanced Features
  MANAGE_GAME_CONFIG: "manage_game_config",
  ACCESS_ADMIN_PANEL: "access_admin_panel",
  SEND_NOTIFICATIONS: "send_notifications", // Allows sending push notifications to users

  // Tablet-specific permissions
  SCOUT_ON_BEHALF: "scout_on_behalf", // Allows submitting data on behalf of other users

  // Override permissions — grants edit/delete rights over any user's entries
  OVERRIDE_MATCH_SCOUTING: "override_match_scouting",
  OVERRIDE_PIT_SCOUTING: "override_pit_scouting",
} as const;

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    // Full access to everything
    ...Object.values(PERMISSIONS),
  ],
  [ROLES.LEAD_SCOUT]: [
    // Scouting operations, is able to do almost everything except user management and system settings
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_COMMENTS,

    PERMISSIONS.CREATE_MATCH_SCOUTING,
    PERMISSIONS.EDIT_MATCH_SCOUTING,
    PERMISSIONS.DELETE_MATCH_SCOUTING,
    PERMISSIONS.VIEW_MATCH_SCOUTING,

    PERMISSIONS.CREATE_PIT_SCOUTING,
    PERMISSIONS.EDIT_PIT_SCOUTING,
    PERMISSIONS.DELETE_PIT_SCOUTING,
    PERMISSIONS.VIEW_PIT_SCOUTING,

    PERMISSIONS.VIEW_PICKLIST,
    PERMISSIONS.CREATE_PICKLIST,
    PERMISSIONS.EDIT_PICKLIST,
    PERMISSIONS.DELETE_PICKLIST,

    PERMISSIONS.VIEW_SCHEDULE,
    PERMISSIONS.CREATE_SCHEDULE,
    PERMISSIONS.EDIT_SCHEDULE,
    PERMISSIONS.DELETE_SCHEDULE,
    PERMISSIONS.VIEW_USERS, // Can view users for schedule assignments

    // Allow lead scouts to manage "friends" / preferred partners for any user
    PERMISSIONS.EDIT_USERS,

    PERMISSIONS.CONFIGURE_EVENTS,
    PERMISSIONS.MANAGE_EVENT_SETTINGS,

    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.IMPORT_DATA,

    PERMISSIONS.OVERRIDE_MATCH_SCOUTING,
    PERMISSIONS.OVERRIDE_PIT_SCOUTING,
  ],
  [ROLES.SCOUT]: [
    // Basic scouting permissions - can view and create/edit their own scouting data
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_COMMENTS,

    PERMISSIONS.CREATE_MATCH_SCOUTING,
    PERMISSIONS.EDIT_MATCH_SCOUTING, // Can edit their own entries
    PERMISSIONS.VIEW_MATCH_SCOUTING,

    PERMISSIONS.CREATE_PIT_SCOUTING,
    PERMISSIONS.EDIT_PIT_SCOUTING, // Can edit their own entries
    PERMISSIONS.VIEW_PIT_SCOUTING,

    PERMISSIONS.VIEW_PICKLIST,
    PERMISSIONS.VIEW_SCHEDULE,
    PERMISSIONS.VIEW_USERS, // Can see who else is assigned to schedule blocks
  ],
  [ROLES.TABLET]: [
    // Tablet accounts can scout on behalf of others - minimal permissions + scout selection
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_COMMENTS,

    PERMISSIONS.CREATE_MATCH_SCOUTING,
    PERMISSIONS.EDIT_MATCH_SCOUTING,
    PERMISSIONS.VIEW_MATCH_SCOUTING,

    PERMISSIONS.CREATE_PIT_SCOUTING,
    PERMISSIONS.EDIT_PIT_SCOUTING,
    PERMISSIONS.VIEW_PIT_SCOUTING,

    PERMISSIONS.VIEW_PICKLIST,
    PERMISSIONS.VIEW_SCHEDULE,
    PERMISSIONS.VIEW_USERS, // Can see who is assigned to schedule blocks

    PERMISSIONS.SCOUT_ON_BEHALF, // Special permission for tablets - implies VIEW_USERS for scout selection
  ],
  [ROLES.VIEWER]: [
    // Read-only access to scouting data and team analysis
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_COMMENTS,

    PERMISSIONS.VIEW_MATCH_SCOUTING,
    PERMISSIONS.VIEW_PIT_SCOUTING,
    PERMISSIONS.VIEW_PICKLIST,
    PERMISSIONS.VIEW_SCHEDULE,
  ],
  [ROLES.EXTERNAL]: [
    // Very limited access, mainly for external teams - no comments due to GP concerns
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_MATCH_SCOUTING, // Can see match data (no comments)
    PERMISSIONS.VIEW_PIT_SCOUTING, // Can see pit data (no comments)
  ],
};

// Helper functions
export function hasPermission(
  userRole: string | null,
  permission: string,
): boolean {
  if (
    !userRole ||
    !ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS]
  ) {
    return false;
  }
  const rolePermissions =
    ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS];
  return (rolePermissions as string[]).includes(permission);
}

export function hasAnyPermission(
  userRole: string | null,
  permissions: string[],
): boolean {
  return permissions.some((permission) => hasPermission(userRole, permission));
}

export function hasAllPermissions(
  userRole: string | null,
  permissions: string[],
): boolean {
  return permissions.every((permission) => hasPermission(userRole, permission));
}

export function getRolePermissions(role: string): string[] {
  return ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || [];
}

export function getAllPermissions(): string[] {
  return Object.values(PERMISSIONS);
}
