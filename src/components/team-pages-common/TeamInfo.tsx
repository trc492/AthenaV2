"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TeamInfoProps {
  teamNumber: string;
  driveTrain?: string;
  weight?: string | number;
  matches?: number;
}

export function TeamInfo({
  teamNumber,
  driveTrain,
  weight,
  matches,
}: TeamInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Team Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Team Number</span>
          <span className="font-medium">{teamNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Drivetrain</span>
          <span className="font-medium">
            {driveTrain ? driveTrain : "Unknown"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Weight</span>
          <span className="font-medium">{weight ? weight : "Unknown"}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Matches</span>
          <span className="font-medium">{matches ? matches : 0}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default TeamInfo;
