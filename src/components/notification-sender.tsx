"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Users, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { APP_LOGO, APP_NAME } from "@/lib/app-config";

interface SendResult {
  successful: number;
  failed: number;
  results: Array<{
    endpoint: string;
    success: boolean;
    error?: string;
  }>;
}

export function NotificationSender() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/dashboard");
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<SendResult | null>(null);
  const handleSendNotification = async () => {
    if (!title.trim()) {
      toast.error("Title required: Please enter a notification title.");
      return;
    }

    setIsLoading(true);
    setLastResult(null);

    try {
      const response = await fetch("/api/notifications/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: {
            title: title.trim(),
            body: body.trim() || undefined,
            url: url.trim() || "/dashboard",
            icon: APP_LOGO,
            badge: APP_LOGO,
            data: {
              timestamp: new Date().toISOString(),
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      setLastResult(result);

      if (result.successful > 0) {
        toast.success(
          `Notifications sent: Successfully sent to ${result.successful} device${result.successful !== 1 ? "s" : ""}`,
        );
        // Clear form on success
        setTitle("");
        setBody("");
      } else {
        toast.error(
          "No notifications sent: No active subscriptions found or all sends failed.",
        );
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      toast.error(
        "Send failed: Failed to send notifications. Check console for details.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    const testTitle = "Test Notification";
    const testBody =
      `This is a test notification from the ${APP_NAME} admin panel.`;

    setTitle(testTitle);
    setBody(testBody);

    // Trigger send with test data
    setTimeout(() => {
      handleSendNotification();
    }, 100);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Send Push Notifications
        </CardTitle>
        <CardDescription>
          Send notifications to all subscribed devices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notification title"
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Message</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Notification message (optional)"
            rows={3}
            maxLength={300}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="url">Link URL</Label>
          <Input
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/dashboard"
          />
          <p className="text-xs text-muted-foreground">
            Where users will go when they click the notification
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSendNotification}
            disabled={isLoading || !title.trim()}
            className="flex-1"
          >
            {isLoading ? "Sending..." : "Send to All"}
            <Users className="ml-2 h-4 w-4" />
          </Button>

          <Button
            onClick={handleTestNotification}
            disabled={isLoading}
            variant="outline"
          >
            Test
          </Button>
        </div>

        {lastResult && (
          <Alert
            className={
              lastResult.successful > 0
                ? "border-primary/20 bg-primary/5"
                : "border-destructive/20 bg-destructive/5"
            }
          >
            {lastResult.successful > 0 ? (
              <CheckCircle className="h-4 w-4 text-primary" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium">
                  {lastResult.successful > 0
                    ? `Successfully sent to ${lastResult.successful} device${lastResult.successful !== 1 ? "s" : ""}`
                    : "No notifications sent"}
                </div>
                {lastResult.failed > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {lastResult.failed} failed
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Notifications are sent to all users who have subscribed</p>
          <p>• Users must have granted notification permissions</p>
          <p>• Notifications work even when the app is closed</p>
        </div>
      </CardContent>
    </Card>
  );
}
