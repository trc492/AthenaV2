"use client";

import * as React from "react";
import { Check, Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { themes, applyTheme } from "@/lib/theme-config";

const colorThemeEvent = "athena-color-theme-change";

function subscribeToColorTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(colorThemeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(colorThemeEvent, onStoreChange);
  };
}

export function ThemeSelector() {
  const colorTheme = React.useSyncExternalStore(
    subscribeToColorTheme,
    () => localStorage.getItem("color-theme") || "green",
    () => "green",
  );

  React.useEffect(() => {
    applyTheme(colorTheme);
  }, [colorTheme]);

  const handleThemeChange = (themeName: string) => {
    localStorage.setItem("color-theme", themeName);
    applyTheme(themeName);
    window.dispatchEvent(new Event(colorThemeEvent));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="size-11 md:size-9">
          <Palette className="h-5 w-5" />
          <span className="sr-only">Choose color theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {themes.map((theme) => (
          <DropdownMenuItem
            key={theme.name}
            onClick={() => handleThemeChange(theme.name)}
            className="flex items-center justify-between"
          >
            <span>{theme.label}</span>
            {colorTheme === theme.name && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
