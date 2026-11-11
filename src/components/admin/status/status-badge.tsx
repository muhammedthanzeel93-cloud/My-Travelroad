import * as React from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  Clock,
  FileSearch,
  Flag,
  PauseCircle,
  Shield,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AdminStatus, VerificationStatus } from "@/data/admin-sample-data";

interface StatusVisualConfig {
  label: string;
  variant: NonNullable<BadgeProps["variant"]>;
  icon: LucideIcon;
  dot?: boolean;
  className?: string;
}

const ADMIN_STATUS_CONFIG: Record<AdminStatus, StatusVisualConfig> = {
  active: {
    label: "Active",
    variant: "subtle",
    icon: CheckCircle2,
    dot: true,
  },
  inactive: {
    label: "Inactive",
    variant: "muted",
    icon: PauseCircle,
  },
  pending: {
    label: "Pending",
    variant: "accentSubtle",
    icon: Clock,
    dot: true,
  },
  approved: {
    label: "Approved",
    variant: "secondarySubtle",
    icon: BadgeCheck,
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
    icon: XCircle,
  },
  suspended: {
    label: "Suspended",
    variant: "outline",
    icon: Ban,
    className: "border-red-300 bg-red-50/70 text-red-800",
  },
};

const VERIFICATION_STATUS_CONFIG: Record<VerificationStatus, StatusVisualConfig> = {
  verified: {
    label: "Verified",
    variant: "subtle",
    icon: ShieldCheck,
  },
  in_review: {
    label: "In Review",
    variant: "secondarySubtle",
    icon: FileSearch,
    dot: true,
  },
  needs_update: {
    label: "Needs Update",
    variant: "accentSubtle",
    icon: AlertTriangle,
  },
  unverified: {
    label: "Unverified",
    variant: "muted",
    icon: Shield,
  },
  flagged: {
    label: "Flagged",
    variant: "destructive",
    icon: Flag,
  },
};

export interface StatusBadgeProps {
  status: AdminStatus;
  label?: string;
  showIcon?: boolean;
  size?: BadgeProps["size"];
  className?: string;
}

/** Parameterized semantic status badge built on Task 01 Badge tokens. */
export function StatusBadge({
  status,
  label,
  showIcon = true,
  size = "default",
  className,
}: StatusBadgeProps) {
  const config = ADMIN_STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      size={size}
      dot={config.dot && !showIcon}
      className={cn("whitespace-nowrap", config.className, className)}
    >
      {showIcon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>{label ?? config.label}</span>
    </Badge>
  );
}

type NamedBadgeProps = Omit<StatusBadgeProps, "status">;

export function ActiveBadge(props: NamedBadgeProps) {
  return <StatusBadge status="active" {...props} />;
}

export function InactiveBadge(props: NamedBadgeProps) {
  return <StatusBadge status="inactive" {...props} />;
}

export function PendingBadge(props: NamedBadgeProps) {
  return <StatusBadge status="pending" {...props} />;
}

export function ApprovedBadge(props: NamedBadgeProps) {
  return <StatusBadge status="approved" {...props} />;
}

export function RejectedBadge(props: NamedBadgeProps) {
  return <StatusBadge status="rejected" {...props} />;
}

export function SuspendedBadge(props: NamedBadgeProps) {
  return <StatusBadge status="suspended" {...props} />;
}

export interface VerificationStatusBadgeProps {
  state: VerificationStatus;
  label?: string;
  showIcon?: boolean;
  size?: BadgeProps["size"];
  className?: string;
}

/** Semantic verification badge for place curation & field review queues. */
export function VerificationStatusBadge({
  state,
  label,
  showIcon = true,
  size = "default",
  className,
}: VerificationStatusBadgeProps) {
  const config = VERIFICATION_STATUS_CONFIG[state];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      size={size}
      dot={config.dot && !showIcon}
      className={cn("whitespace-nowrap", config.className, className)}
    >
      {showIcon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>{label ?? config.label}</span>
    </Badge>
  );
}
