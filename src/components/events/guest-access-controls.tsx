"use client";

import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface GuestAccessSettings {
  canAddScouting: boolean;
  canViewNotes: boolean;
}

export function GuestAccessControls({ value, onChange, disabled = false }: {
  value: GuestAccessSettings;
  onChange: (value: GuestAccessSettings) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return <div className="space-y-4">
    <div className="flex items-start gap-3">
      <Checkbox id={`${id}-scouting`} checked={value.canAddScouting} disabled={disabled} onCheckedChange={(checked) => onChange({ ...value, canAddScouting: checked === true })} />
      <div className="space-y-1"><Label htmlFor={`${id}-scouting`}>Allow scouting submissions</Label><p className="text-xs text-muted-foreground">Guests can add match and pit scouting data for this event. Leave unchecked for viewer-only access.</p></div>
    </div>
    <div className="flex items-start gap-3">
      <Checkbox id={`${id}-notes`} checked={value.canViewNotes} disabled={disabled} onCheckedChange={(checked) => onChange({ ...value, canViewNotes: checked === true })} />
      <div className="space-y-1"><Label htmlFor={`${id}-notes`}>Show scouting notes</Label><p className="text-xs text-muted-foreground">Allow guests to read scouting notes, including guests with viewer-only access.</p></div>
    </div>
  </div>;
}
