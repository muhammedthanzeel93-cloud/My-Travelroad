import { Landmark, Mountain, TreePine, Waves } from "lucide-react";
import type { CategoryIconKey } from "@/data/sample-data";

export function CategoryIcon({
  iconKey,
  className = "h-5 w-5",
}: {
  iconKey: CategoryIconKey;
  className?: string;
}) {
  switch (iconKey) {
    case "forest":
      return <TreePine className={className} aria-hidden="true" />;
    case "coast":
      return <Waves className={className} aria-hidden="true" />;
    case "hills":
      return <Mountain className={className} aria-hidden="true" />;
    case "heritage":
      return <Landmark className={className} aria-hidden="true" />;
  }
}
