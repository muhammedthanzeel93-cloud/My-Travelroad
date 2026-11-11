import {
  BarChart3,
  FolderTree,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Palette,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { AdminNavIconKey } from "./navigation";

/** Maps admin navigation icon keys to Lucide React icons exclusively. */
export function AdminNavIcon({
  iconKey,
  className = "h-4 w-4 shrink-0",
}: {
  iconKey: AdminNavIconKey;
  className?: string;
}) {
  switch (iconKey) {
    case "overview":
      return <LayoutDashboard className={className} aria-hidden="true" />;
    case "destinations":
      return <MapPin className={className} aria-hidden="true" />;
    case "categories":
      return <FolderTree className={className} aria-hidden="true" />;
    case "verification":
      return <ShieldCheck className={className} aria-hidden="true" />;
    case "users":
      return <Users className={className} aria-hidden="true" />;
    case "reviews":
      return <MessageSquare className={className} aria-hidden="true" />;
    case "reports":
      return <BarChart3 className={className} aria-hidden="true" />;
    case "settings":
      return <Settings className={className} aria-hidden="true" />;
    case "designSystem":
      return <Palette className={className} aria-hidden="true" />;
  }
}
