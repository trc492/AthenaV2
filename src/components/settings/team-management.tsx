"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { PERMISSIONS, ROLES } from "@/lib/auth/roles";
import { Plus, Edit, UserRoundX, RotateCcw, Users } from "lucide-react";
import { toast } from "sonner";
interface User {
  id: string;
  name: string;
  username: string;
  role: string;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateUserData {
  name: string;
  username: string;
  password: string;
  role: string;
}

interface UpdateUserData {
  name?: string;
  username?: string;
  password?: string;
  role?: string;
}

/** Returns all users, or null (after notifying the user) on failure. */
async function loadUsers(): Promise<User[] | null> {
  try {
    const response = await fetch("/api/users?includeInactive=true");
    if (!response.ok) {
      throw new Error("Failed to fetch users");
    }
    const data = await response.json();
    return data.users;
  } catch (error) {
    console.error("Error fetching users:", error);
    toast.error(
      error instanceof Error ? error.message : "Failed to fetch users",
    );
    return null;
  }
}

export function TeamManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [createForm, setCreateForm] = useState<CreateUserData>({
    name: "",
    username: "",
    password: "",
    role: "scout",
  });
  const [editForm, setEditForm] = useState<UpdateUserData>({
    role: "scout",
  });
  const [statusSaving, setStatusSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [userToChange, setUserToChange] = useState<User | null>(null);
  const fetchUsers = useCallback(async () => {
    const loaded = await loadUsers();
    if (loaded) setUsers(loaded);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadUsers().then((loaded) => {
      if (cancelled) return;
      if (loaded) setUsers(loaded);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateUser = async () => {
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create user");
      }

      toast.success("User created successfully");

      setCreateForm({
        name: "",
        username: "",
        password: "",
        role: "scout",
      });
      setCreateDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create user",
      );
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update user");
      }

      toast.success("User updated successfully");

      setEditDialogOpen(false);
      setEditingUser(null);
      setEditForm({ role: "scout" });
      fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update user",
      );
    }
  };

  const handleChangeUserStatus = async () => {
    if (!userToChange || statusSaving) return;
    setStatusSaving(true);

    try {
      const response = await fetch(`/api/users/${userToChange.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !!userToChange.deactivatedAt }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to change user status");
      }

      toast.success(userToChange.deactivatedAt ? "User restored successfully" : "User deactivated successfully");
      setStatusDialogOpen(false);
      setUserToChange(null);
      fetchUsers();
    } catch (error) {
      console.error("Error changing user status:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to change user status",
      );
    } finally {
      setStatusSaving(false);
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      username: user.username,
      role: user.role,
    });
    setEditDialogOpen(true);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case ROLES.ADMIN:
        return "destructive";
      case ROLES.LEAD_SCOUT:
        return "default";
      case ROLES.SCOUT:
        return "secondary";
      case ROLES.TABLET:
        return "default";
      case ROLES.VIEWER:
        return "outline";
      default:
        return "secondary";
    }
  };

  const formatRoleName = (role: string) => {
    switch (role) {
      case ROLES.ADMIN:
        return "Admin";
      case ROLES.LEAD_SCOUT:
        return "Lead Scout";
      case ROLES.SCOUT:
        return "Scout";
      case ROLES.TABLET:
        return "Tablet";
      case ROLES.VIEWER:
        return "Viewer";
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading users...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Management
            </CardTitle>
            <PermissionGuard permission={PERMISSIONS.CREATE_USERS}>
              <Dialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="create-name">Full Name</Label>
                      <Input
                        id="create-name"
                        value={createForm.name}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, name: e.target.value })
                        }
                        placeholder="Enter full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-username">Username</Label>
                      <Input
                        id="create-username"
                        value={createForm.username}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            username: e.target.value,
                          })
                        }
                        placeholder="Enter username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-password">Password</Label>
                      <Input
                        id="create-password"
                        type="password"
                        value={createForm.password}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            password: e.target.value,
                          })
                        }
                        placeholder="Enter password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-role">Role</Label>
                      <Select
                        value={createForm.role}
                        onValueChange={(value) =>
                          setCreateForm({ ...createForm, role: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="lead_scout">Lead Scout</SelectItem>
                          <SelectItem value="tablet">Tablet</SelectItem>
                          <SelectItem value="scout">Scout</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setCreateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleCreateUser}>Create User</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </PermissionGuard>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">Deactivate members to remove access while preserving their scouting history. You can restore them later.</p>
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            Show deactivated users
          </label>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.filter((user) => showInactive || !user.deactivatedAt).map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {formatRoleName(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge variant={user.deactivatedAt ? "outline" : "secondary"}>{user.deactivatedAt ? "Deactivated" : "Active"}</Badge></TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <PermissionGuard permission={PERMISSIONS.EDIT_USERS}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </PermissionGuard>
                      <PermissionGuard permission={PERMISSIONS.DELETE_USERS}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUserToChange(user);
                            setStatusDialogOpen(true);
                          }}
                        >
                          {user.deactivatedAt ? <RotateCcw className="h-4 w-4" /> : <UserRoundX className="h-4 w-4" />}
                          {user.deactivatedAt ? "Restore" : "Deactivate"}
                        </Button>
                      </PermissionGuard>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {users.filter((user) => showInactive || !user.deactivatedAt).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No users to display. Add a user or show deactivated users.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account status confirmation */}
      <DeleteConfirmationDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        onConfirm={handleChangeUserStatus}
        loading={statusSaving}
        variant={userToChange?.deactivatedAt ? "default" : "destructive"}
        title={userToChange?.deactivatedAt ? "Restore User" : "Deactivate User"}
        description={
          userToChange ? (
            <span>
              {userToChange.deactivatedAt ? "Restore" : "Deactivate"}{" "}
              <strong>{userToChange.name}</strong>?
              {userToChange.deactivatedAt
                ? " They will be able to log in again with their existing account."
                : " They will lose access and be hidden from scout and assignment lists. Their scouting history will be preserved, and you can restore them later."}
            </span>
          ) : null
        }
        confirmButtonText={userToChange?.deactivatedAt ? "Restore" : "Deactivate"}
        loadingText="Saving..."
      />

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editForm.name || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                placeholder="Enter full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editForm.username || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, username: e.target.value })
                }
                placeholder="Enter username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">
                New Password (leave blank to keep current)
              </Label>
              <Input
                id="edit-password"
                type="password"
                value={editForm.password || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, password: e.target.value })
                }
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editForm.role || "scout"}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scout">Scout</SelectItem>
                  <SelectItem value="lead_scout">Lead Scout</SelectItem>
                  <SelectItem value="tablet">Tablet</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateUser}>Update User</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
