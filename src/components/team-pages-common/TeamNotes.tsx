"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useSession } from "next-auth/react";

interface TeamNotesProps {
  notes: string[];
  searchNote: string;
  setSearchNote: (val: string) => void;
}

export function TeamNotes({
  notes,
  searchNote,
  setSearchNote,
}: TeamNotesProps) {
  const { data: session } = useSession();
  const filtered = notes.filter((n) =>
    n.toLowerCase().includes(searchNote.toLowerCase()),
  );
  if (session?.guestEvent) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scouting Notes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search notes..."
            value={searchNote}
            onChange={(e) => setSearchNote(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((note, index) => (
              <div key={index} className="p-3 bg-muted/50 rounded-md border">
                <p className="text-sm">{note}</p>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              {notes.length === 0 ? (
                <p>No scouting notes available for this team yet.</p>
              ) : (
                <p>No notes match your search criteria.</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default TeamNotes;
