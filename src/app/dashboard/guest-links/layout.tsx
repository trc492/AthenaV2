import { SettingsNavigation } from "@/components/settings/settings-navigation";

export default function GuestLinksLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-6">
      <SettingsNavigation />
      {children}
    </div>
  );
}
