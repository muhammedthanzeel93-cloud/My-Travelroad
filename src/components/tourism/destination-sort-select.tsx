"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function DestinationSortSelect({
  currentSort = "popular",
}: {
  currentSort?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2.5">
      <Label
        htmlFor="destination-sort"
        className="text-xs font-medium uppercase tracking-wider text-text-secondary whitespace-nowrap"
      >
        Sort by
      </Label>
      <Select value={currentSort} onValueChange={handleSortChange}>
        <SelectTrigger id="destination-sort" className="w-[215px] h-9 bg-surface">
          <SelectValue placeholder="Sort destinations" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="popular">Popular Order (Sample)</SelectItem>
          <SelectItem value="featured">Featured First (Sample)</SelectItem>
          <SelectItem value="alphabetical">Alphabetical (A–Z)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
