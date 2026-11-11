import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SearchBarFormProps {
  action?: "/search" | "/destinations";
  defaultValue?: string;
  category?: string;
  placeholder?: string;
  buttonLabel?: string;
  className?: string;
}

export function SearchBarForm({
  action = "/search",
  defaultValue = "",
  category,
  placeholder = "Search Malappuram destinations (e.g. Nilambur, Kadalundi, Heritage)...",
  buttonLabel = "Search",
  className,
}: SearchBarFormProps) {
  return (
    <form
      action={action}
      method="GET"
      role="search"
      className={cn("flex w-full flex-col gap-2.5 sm:flex-row", className)}
    >
      {category && category !== "all" && (
        <input type="hidden" name="category" value={category} />
      )}
      <div className="flex-1">
        <label htmlFor={`search-input-${action.replace("/", "")}`} className="sr-only">
          Search destinations
        </label>
        <Input
          id={`search-input-${action.replace("/", "")}`}
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          startIcon={<Search className="h-4 w-4" />}
          className="h-11 bg-surface"
        />
      </div>
      <Button type="submit" size="lg" className="h-11 shrink-0 px-6">
        {buttonLabel}
      </Button>
    </form>
  );
}
