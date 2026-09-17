"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

interface AdminAccessDeniedProps {
  title?: string;
  description?: string;
}

export function AdminAccessDenied({
  title = "Access Restricted",
  description = "You do not have the required administrative permissions to access this page.",
}: AdminAccessDeniedProps) {
  return (
    <Card className="max-w-md mx-auto my-12 text-center">
      <CardHeader className="flex flex-col items-center gap-2">
        <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
