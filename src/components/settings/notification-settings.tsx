"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, Check, X, AlertTriangle, Smartphone } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { toast } from "sonner";

export function NotificationSettings() {
  const {
    permission,
    isSupported,
    isSubscribed,
    error,
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
  } = useNotifications();

  const [isLoading, setIsLoading] = useState(false);

  const handlePermissionRequest = async () => {
    setIsLoading(true);
    const granted = await requestPermission();
    setIsLoading(false);

    if (granted) {
      toast.success("Notification permissions granted");
    } else {
      toast.error(
        "Permission denied: Notifications have been blocked. You can enable them in your browser settings.",
      );
    }
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    const subscription = await subscribe();
    setIsLoading(false);

    if (subscription) {
      toast.success(
        "Notifications enabled: You're now subscribed to push notifications.",
      );
    }
  };

  const handleUnsubscribe = async () => {
    setIsLoading(true);
    const success = await unsubscribe();
    setIsLoading(false);

    if (success) {
      toast.success(
        "Notifications disabled: You've unsubscribed from push notifications.",
      );
    }
  };

  const handleTestNotification = async () => {
    const success = await showNotification({
      title: "Test Notification",
      body: "This is a test notification from TRC Scouting!",
      data: { url: "/dashboard" },
    });

    if (success) {
      toast.success(
        "Test notification sent: Check your notification area to see it.",
      );
    }
  };

  const getPermissionStatus = () => {
    switch (permission) {
      case "granted":
        return {
          icon: <Check className="h-4 w-4 text-primary" />,
          text: "Granted",
          color: "text-primary",
        };
      case "denied":
        return {
          icon: <X className="h-4 w-4 text-destructive" />,
          text: "Denied",
          color: "text-destructive",
        };
      default:
        return {
          icon: <AlertTriangle className="h-4 w-4 text-chart-4" />,
          text: "Not requested",
          color: "text-chart-4",
        };
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Notifications are not supported in this browser or device.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const permissionStatus = getPermissionStatus();

  return (
    <Card>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Permission Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="font-medium">Browser Permissions</Label>
                <p className="text-sm text-muted-foreground">
                  Allow TRC Scouting to show notifications
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {permissionStatus.icon}
              <span className={`text-sm font-medium ${permissionStatus.color}`}>
                {permissionStatus.text}
              </span>
            </div>
          </div>

          {permission !== "granted" && (
            <Button
              onClick={handlePermissionRequest}
              disabled={isLoading || permission === "denied"}
              variant={permission === "denied" ? "secondary" : "default"}
              className="w-full"
            >
              {isLoading
                ? "Requesting..."
                : permission === "denied"
                  ? "Blocked (Check Browser Settings)"
                  : "Request Permission"}
            </Button>
          )}
        </div>

        <Separator />

        {/* Push Notification Subscription */}
        {permission === "granted" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="font-medium">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications even when the app is closed
                  </p>
                </div>
              </div>
              <Switch
                checked={isSubscribed}
                onCheckedChange={
                  isSubscribed ? handleUnsubscribe : handleSubscribe
                }
                disabled={isLoading}
              />
            </div>

            {isSubscribed && (
              <div className="space-y-3">
                <Button
                  onClick={handleTestNotification}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Send Test Notification
                </Button>

                <Alert>
                  <Check className="h-4 w-4" />
                  <AlertDescription>
                    <div>
                      <p>
                        You're subscribed to push notifications.
                        You'll receive notifications about:
                      </p>
                      <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                        <li>Scouting Schedule Reminders</li>
                        <li>Important Announcements</li>
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
