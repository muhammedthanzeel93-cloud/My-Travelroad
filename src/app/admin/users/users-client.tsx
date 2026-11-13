"use client";

import * as React from "react";
import {
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  Shield,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminSampleBanner } from "@/components/admin/feedback/admin-sample-banner";
import { ConfirmDialog } from "@/components/admin/feedback/confirm-dialog";
import { adminToast } from "@/components/admin/feedback/admin-toast";
import { StatCard } from "@/components/admin/dashboard/stat-card";
import { StatusBadge } from "@/components/admin/status/status-badge";
import { AdminSearchInput } from "@/components/admin/tables/admin-search-input";
import { TableFilterBar } from "@/components/admin/tables/table-filters";
import { TableToolbar } from "@/components/admin/tables/table-toolbar";
import { RowActionMenu } from "@/components/admin/tables/row-action-menu";
import { TablePagination } from "@/components/admin/tables/table-pagination";
import { AdminStateTabs } from "@/components/admin/tables/admin-state-tabs";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/admin/tables/data-table";
import { useAdminTableState } from "@/components/admin/tables/use-admin-table-state";
import {
  ADMIN_USER_RECORDS,
  type AdminSampleUserAccount,
} from "@/data/admin-sample-data";

export function UsersClient() {
  const {
    tableMode,
    setTableMode,
    searchQuery,
    setSearchQuery,
    sortKey,
    sortDirection,
    handleSortChange,
    setCurrentPage,
    paginateRows,
  } = useAdminTableState({
    initialSortKey: "name",
    pageSize: 6,
  });

  const [roleFilter, setRoleFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [profilePreviewUser, setProfilePreviewUser] =
    React.useState<AdminSampleUserAccount | null>(null);
  const [suspendTarget, setSuspendTarget] =
    React.useState<AdminSampleUserAccount | null>(null);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    roleFilter !== "all" ||
    statusFilter !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setCurrentPage(1);
    setTableMode("data");
  };

  const activeUsers = ADMIN_USER_RECORDS.filter(
    (u) => u.status === "active"
  ).length;
  const pendingUsers = ADMIN_USER_RECORDS.filter(
    (u) => u.status === "pending"
  ).length;
  const suspendedUsers = ADMIN_USER_RECORDS.filter(
    (u) => u.status === "suspended"
  ).length;

  const filteredUsers = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ADMIN_USER_RECORDS.filter((user) => {
      const matchesQuery =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.region.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" || user.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    }).sort((a, b) => {
      const valA =
        sortKey === "role"
          ? a.role
          : sortKey === "status"
          ? a.status
          : a.name;
      const valB =
        sortKey === "role"
          ? b.role
          : sortKey === "status"
          ? b.status
          : b.name;
      const comparison = valA.localeCompare(valB);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [searchQuery, roleFilter, statusFilter, sortKey, sortDirection]);

  const { totalPages, safePage, pageSize, paginatedRows } =
    paginateRows(filteredUsers);

  const columns: DataTableColumn<AdminSampleUserAccount>[] = [
    {
      key: "name",
      header: "User Profile Summary",
      mobileLabel: "User",
      mobileRole: "primary",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3 md:min-w-[200px]">
          <Avatar size="sm">
            <AvatarFallback>{row.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-0.5">
            <p className="truncate font-semibold text-text-primary">
              {row.name}
            </p>
            <p className="truncate text-xs text-text-secondary">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      mobileRole: "status",
      sortable: true,
      cell: (row) => (
        <Badge
          variant={
            row.role === "District Curator"
              ? "subtle"
              : row.role === "Moderator"
              ? "secondarySubtle"
              : "muted"
          }
          size="sm"
          className="whitespace-nowrap"
        >
          {row.role}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Account Status",
      mobileLabel: "Status",
      mobileRole: "status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: "activity",
      header: "Region & Contributions",
      mobileRole: "secondary",
      cell: (row) => (
        <div className="text-xs md:whitespace-nowrap">
          <p className="font-medium text-text-primary">{row.region}</p>
          <p className="text-[11px] text-text-secondary tabular-nums">
            {row.savedCount} saved &bull; {row.submissionsCount} submissions
          </p>
        </div>
      ),
    },
    {
      key: "registeredAt",
      header: "Registered",
      mobileRole: "secondary",
      cell: (row) => (
        <span className="text-xs text-text-secondary md:whitespace-nowrap">
          {row.registeredAt}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      mobileRole: "actions",
      align: "right",
      cell: (row) => (
        <RowActionMenu
          rowLabel={row.name}
          actions={[
            {
              id: "profile",
              label: "Inspect Profile Summary",
              icon: Eye,
              onSelect: () => setProfilePreviewUser(row),
            },
            {
              id: "role",
              label: "Assign Role (Placeholder)",
              icon: Shield,
              onSelect: () =>
                adminToast.info(
                  "Role Management Placeholder",
                  `Role assignment for ${row.name} requires backend RBAC APIs.`
                ),
            },
            {
              id: "suspend",
              label: "Suspend Account (Guard)",
              icon: Ban,
              destructive: true,
              separatorBefore: true,
              onSelect: () => setSuspendTarget(row),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumbs={[{ label: "Users" }]}
        title="User Management"
        description="Review sample explorer, contributor, moderator, and curator accounts with role/status filtering and non-functional account action guards."
        badge={
          <Badge variant="accentSubtle" dot>
            {ADMIN_USER_RECORDS.length} Sample Accounts
          </Badge>
        }
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() =>
              adminToast.info(
                "Invite Curator (Placeholder)",
                "Curator invitations and authentication onboarding are excluded in Task 04."
              )
            }
          >
            <UserPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Invite Curator (Preview)
          </Button>
        }
      />

      <AdminSampleBanner
        title="Account Directory (No Auth or Role Mutations):"
        description="Account rows display synthetic sample users. Role edits and suspension dialogs trigger preview notices only."
      />

      {/* User Statistics */}
      <section aria-labelledby="users-stats-heading">
        <h2 id="users-stats-heading" className="sr-only">
          User statistics summary
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Sample Users"
            value={ADMIN_USER_RECORDS.length}
            icon={Users}
            tone="primary"
            loading={tableMode === "loading"}
            footnote="Sample registered directory"
          />
          <StatCard
            title="Active Accounts"
            value={activeUsers}
            icon={CheckCircle2}
            tone="secondary"
            loading={tableMode === "loading"}
            footnote="Explorers, contributors & curators"
          />
          <StatCard
            title="Pending Accounts"
            value={pendingUsers}
            icon={Clock}
            tone="accent"
            loading={tableMode === "loading"}
            footnote="Awaiting onboarding preview"
          />
          <StatCard
            title="Suspended Accounts"
            value={suspendedUsers}
            icon={UserCheck}
            tone="muted"
            loading={tableMode === "loading"}
            footnote="Demo restricted status"
          />
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">
          Filter registered user rows by role or account status.
        </p>
        <AdminStateTabs value={tableMode} onValueChange={setTableMode} />
      </div>

      <Card>
        <CardContent className="p-3.5 sm:p-5 space-y-4 sm:space-y-5">
          <TableToolbar
            searchSlot={
              <AdminSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search user name, email, Malappuram area..."
              />
            }
            filtersSlot={
              <TableFilterBar
                hasActiveFilters={hasActiveFilters}
                onResetFilters={handleResetFilters}
                filters={[
                  {
                    id: "user-role-filter",
                    label: "Role",
                    value: roleFilter,
                    onValueChange: (val) => {
                      setRoleFilter(val);
                      setCurrentPage(1);
                    },
                    options: [
                      { value: "all", label: "All Roles" },
                      { value: "Explorer", label: "Explorer" },
                      { value: "Contributor", label: "Contributor" },
                      { value: "District Curator", label: "District Curator" },
                      { value: "Moderator", label: "Moderator" },
                    ],
                  },
                  {
                    id: "user-status-filter",
                    label: "Account Status",
                    value: statusFilter,
                    onValueChange: (val) => {
                      setStatusFilter(val);
                      setCurrentPage(1);
                    },
                    options: [
                      { value: "all", label: "All Statuses" },
                      { value: "active", label: "Active" },
                      { value: "pending", label: "Pending" },
                      { value: "inactive", label: "Inactive" },
                      { value: "suspended", label: "Suspended" },
                    ],
                  },
                ]}
              />
            }
          />

          <DataTable
            caption="My Travelroad sample user accounts table"
            data={tableMode === "empty" ? [] : paginatedRows}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.name}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            isLoading={tableMode === "loading"}
            errorMessage={
              tableMode === "error"
                ? "ERR_USERS_PREVIEW_503: Simulated user directory retrieval issue."
                : undefined
            }
            onRetry={() => {
              setTableMode("data");
              adminToast.success(
                "User Table Restored",
                "Returned to populated sample accounts."
              );
            }}
            emptyTitle="No matching users found"
            emptyDescription="Clear active role or status filters to restore sample user records."
            emptyAction={
              <Button type="button" size="sm" onClick={handleResetFilters}>
                Reset User Filters
              </Button>
            }
          />

          {tableMode === "data" && filteredUsers.length > 0 && (
            <TablePagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={filteredUsers.length}
              pageSize={pageSize}
              itemLabel="sample users"
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Read-only Profile Summary Dialog */}
      <Dialog
        open={profilePreviewUser !== null}
        onOpenChange={(open) => {
          if (!open) setProfilePreviewUser(null);
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>User Profile Summary (Sample)</DialogTitle>
            <DialogDescription>
              Read-only overview demonstrating account metadata structure.
            </DialogDescription>
          </DialogHeader>

          {profilePreviewUser && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="flex items-center gap-3.5 rounded-xl border border-border bg-slate-50/70 p-4">
                <Avatar size="lg">
                  <AvatarFallback>{profilePreviewUser.initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-text-primary truncate">
                    {profilePreviewUser.name}
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {profilePreviewUser.email}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <Badge variant="subtle" size="sm">
                      {profilePreviewUser.role}
                    </Badge>
                    <StatusBadge status={profilePreviewUser.status} size="sm" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-text-secondary">Saved</p>
                  <p className="mt-1 text-lg font-bold text-text-primary tabular-nums">
                    {profilePreviewUser.savedCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-text-secondary">Submissions</p>
                  <p className="mt-1 text-lg font-bold text-text-primary tabular-nums">
                    {profilePreviewUser.submissionsCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-text-secondary">District Zone</p>
                  <p className="mt-1 font-semibold text-text-primary truncate">
                    {profilePreviewUser.region}
                  </p>
                </div>
              </div>

              <p className="text-xs text-text-secondary">
                Registered: {profilePreviewUser.registeredAt}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setProfilePreviewUser(null)}
            >
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={suspendTarget !== null}
        onOpenChange={(open) => {
          if (!open) setSuspendTarget(null);
        }}
        title="Suspend sample user account?"
        description="Confirmation dialog guard only. Account suspension logic is excluded from Task 04."
        targetLabel={suspendTarget?.name}
        variant="destructive"
        confirmLabel="Suspend Preview"
        onConfirm={() =>
          adminToast.info(
            "Suspension Guard Completed (Preview)",
            `${suspendTarget?.name ?? "Account"} was not modified.`
          )
        }
      />
    </div>
  );
}
