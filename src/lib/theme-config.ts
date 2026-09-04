export type ThemeConfig = {
  name: string;
  label: string;
};

export const themes: ThemeConfig[] = [
  { name: "green", label: "Green (Default)" },
  { name: "rustic", label: "Rustic" },
  { name: "blue", label: "Blue" },
  { name: "purple", label: "Purple" },
  { name: "rose", label: "Rose" },
  { name: "orange", label: "Orange" },
];

export function getTheme(name: string): ThemeConfig | undefined {
  return themes.find((theme) => theme.name === name);
}

export function applyTheme(themeName: string) {
  const root = document.documentElement;
  root.setAttribute("data-theme", themeName);
}
