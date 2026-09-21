"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  username: string;
}

export function AccountSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: session, update } = useSession();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Preferred partners state
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [savingPartners, setSavingPartners] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Initialize form with current user data
  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || "");
      setUsername(session.user.username || "");
      setAvatarPreview(session.user.avatarUrl || session.user.image || null);
    }
  }, [session, open]);

  // Fetch users and preferred partners when dialog opens
  useEffect(() => {
    if (open) {
      fetchUsers();
      fetchPreferredPartners();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset password fields when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [open]);

  async function fetchUsers() {
    setLoadingUsers(true);
    try {
      const response = await fetch("/api/users");
      const data = await response.json();
      if (response.ok) {
        setAllUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function fetchPreferredPartners() {
    try {
      const response = await fetch("/api/users/me/preferred-partners");
      const data = await response.json();
      if (response.ok && data.preferredPartners) {
        setSelectedPartners(data.preferredPartners);
      }
    } catch (error) {
      console.error("Error fetching preferred partners:", error);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !username.trim()) {
      toast.error("Name and username are required");
      return;
    }

    setSaving(true);
    try {
      let avatarUrl = session?.user?.image;

      if (avatarFile) {
        const reader = new FileReader();

        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(avatarFile);
        });

        const avatarResponse = await fetch("/api/users/me/avatar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ dataUrl }),
        });

        const avatarData = await avatarResponse.json();

        if (!avatarResponse.ok) {
          throw new Error(avatarData.error || "Failed to upload avatar");
        }

        avatarUrl = avatarData.avatarUrl;
      }

      // save profile info
      const response = await fetch("/api/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      // Update the session to reflect changes
      await update({
        ...session,
        user: {
          ...session?.user,
          name: name.trim(),
          username: username.trim(),
          image: avatarUrl,
          avatarUrl,
        },
      });

      setAvatarFile(null);

      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Save error:", error);

      toast.error(
        error instanceof Error ? error.message : "Failed to update profile",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All password fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch("/api/users/me/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Password change error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to change password",
      );
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleSavePreferredPartners() {
    setSavingPartners(true);
    try {
      const response = await fetch("/api/users/me/preferred-partners", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          preferredPartners: selectedPartners,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update preferred partners");
      }

      toast.success("Preferred partners updated successfully");
    } catch (error) {
      console.error("Save partners error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update preferred partners",
      );
    } finally {
      setSavingPartners(false);
    }
  }

  function togglePartner(userId: string) {
    setSelectedPartners((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }

  const availablePartners = allUsers.filter(
    (user) => user.id !== session?.user?.id,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Account Settings</DialogTitle>
          <DialogDescription>
            Manage your profile, password, and scheduling preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Profile Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Profile Information</h3>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  autoComplete="name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                  autoComplete="username"
                  required
                />
              </div>

              {/* Avatar Upload */}
              <div>
                <Label>Profile Image</Label>
                <div className="flex items-center gap-3 pt-2">

                  <div className="w-20 h-20 rounded-lg overflow-hidden border bg-muted/10 flex items-center justify-center">
                    {avatarPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarPreview}
                        alt="avatar preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-sm text-muted-foreground">No image</div>
                    )}
                  </div>
                  <div className="flex flex-row gap-2">
                    <Button variant="ghost">
                      <label>
                        {avatarFile ? "Change Image" : "Upload Image"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setAvatarFile(file);
                            if (file) {
                              setAvatarPreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                      </label>
                    </Button>
                    <Button variant="ghost" onClick={() => {setAvatarFile(null); setAvatarPreview(null)}}>
                      Remove
                    </Button>
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </form>
          </div>

          <Separator />

          {/* Change Password */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Change Password</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={changingPassword} className="mt-2">
                {changingPassword ? "Changing..." : "Change Password"}
              </Button>
            </form>
          </div>

          <Separator />

          {/* Preferred Scouting Partners */}
          <div>
            <h3 className="text-lg font-semibold mb-2">
              Preferred Scouting Partners
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select users you prefer to scout with. The schedule will try to
              pair you together when possible.
            </p>
            {loadingUsers ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Loading users...
              </p>
            ) : (
              <>
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-4">
                  {availablePartners.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`partner-${user.id}`}
                        checked={selectedPartners.includes(user.id)}
                        onCheckedChange={() => togglePartner(user.id)}
                      />
                      <label
                        htmlFor={`partner-${user.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {user.name} (@{user.username})
                      </label>
                    </div>
                  ))}
                  {availablePartners.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No other users available
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleSavePreferredPartners}
                  disabled={savingPartners}
                  className="mt-4"
                >
                  {savingPartners ? "Saving..." : "Save Preferred Partners"}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
