"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";

export function SearchForm({ ...props }: React.ComponentProps<"form">) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const router = useRouter();
  const [teamId, setTeamId] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (teamId) {
      router.push(`/dashboard/team/${teamId}`);
      if (isMobile) setOpenMobile(false);
    }
  };

  return (
    <form {...props} onSubmit={handleSubmit}>
      <SidebarGroup className="py-0 ps-0">
        <SidebarGroupContent className="relative">
          <Label htmlFor="search" className="sr-only">
            Search
          </Label>
          <SidebarInput
            id="search"
            placeholder="Search a team..."
            className={state == "collapsed" ? "pl-5" : "pl-8"}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            // hidden={state == "collapsed" }
          />
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
        </SidebarGroupContent>
      </SidebarGroup>
    </form>
  );
}
