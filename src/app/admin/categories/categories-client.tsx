"use client";

import * as React from "react";
import {
  CheckCircle2,
  FolderTree,
  Layers,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
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
  AdminSelectField,
  AdminTextField,
  AdminTextareaField,
} from "@/components/admin/forms/admin-form-fields";
import {
  ADMIN_CATEGORY_RECORDS,
  type AdminSampleCategory,
} from "@/data/admin-sample-data";

export function CategoriesClient() {
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

  const [statusFilter, setStatusFilter] = React.useState("all");
  const [modalMode, setModalMode] = React.useState<"add" | "edit" | null>(null);
  const [draftName, setDraftName] = React.useState("");
  const [draftSlug, setDraftSlug] = React.useState("");
  const [draftDescription, setDraftDescription] = React.useState("");
  const [draftStatus, setDraftStatus] = React.useState("active");
  const [deleteTarget, setDeleteTarget] =
    React.useState<AdminSampleCategory | null>(null);

  const openAddDialog = () => {
    setModalMode("add");
    setDraftName("");
    setDraftSlug("");
    setDraftDescription("");
    setDraftStatus("active");
  };

  const openEditDialog = (cat: AdminSampleCategory) => {
    setModalMode("edit");
    setDraftName(cat.name);
    setDraftSlug(cat.slug);
    setDraftDescription(cat.description);
    setDraftStatus(cat.status);
  };

  const hasActiveFilters = searchQuery.trim() !== "" || statusFilter !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setCurrentPage(1);
    setTableMode("data");
  };

  const filteredCategories = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ADMIN_CATEGORY_RECORDS.filter((cat) => {
      const matchesQuery =
        !query ||
        cat.name.toLowerCase().includes(query) ||
        cat.slug.toLowerCase().includes(query) ||
        cat.description.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" || cat.status === statusFilter;
      return matchesQuery && matchesStatus;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortKey === "destinationCount") {
        comparison = a.destinationCount - b.destinationCount;
      } else if (sortKey === "status") {
        comparison = a.status.localeCompare(b.status);
      } else {
        comparison = a.name.localeCompare(b.name);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [searchQuery, statusFilter, sortKey, sortDirection]);

  const { totalPages, safePage, pageSize, paginatedRows } =
    paginateRows(filteredCategories);

  const activeCount = ADMIN_CATEGORY_RECORDS.filter(
    (c) => c.status === "active"
  ).length;
  const totalLinked = ADMIN_CATEGORY_RECORDS.reduce(
    (acc, c) => acc + c.destinationCount,
    0
  );

  const columns: DataTableColumn<AdminSampleCategory>[] = [
    {
      key: "name",
      header: "Category",
      mobileRole: "primary",
      sortable: true,
      cell: (row) => (
        <div className="flex items-start gap-2.5 md:min-w-[160px]">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FolderTree className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="font-semibold text-text-primary">{row.name}</p>
            <code className="text-[11px] font-mono text-text-secondary">
              /{row.slug}
            </code>
          </div>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      mobileRole: "description",
      cell: (row) => (
        <p
          title={row.description}
          className="text-xs text-text-secondary leading-relaxed md:min-w-[200px] md:max-w-[320px] md:line-clamp-2"
        >
          {row.description}
        </p>
      ),
    },
    {
      key: "destinationCount",
      header: "Destinations",
      mobileLabel: "Linked Destinations",
      mobileRole: "secondary",
      align: "center",
      sortable: true,
      cell: (row) => (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-text-primary tabular-nums">
          {row.destinationCount}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobileRole: "status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: "updatedAt",
      header: "Updated",
      mobileLabel: "Last Updated",
      mobileRole: "secondary",
      cell: (row) => (
        <span className="text-xs text-text-secondary md:whitespace-nowrap">
          {row.updatedAt}
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
              id: "edit",
              label: "Edit Category (Placeholder)",
              icon: Pencil,
              onSelect: () => openEditDialog(row),
            },
            {
              id: "delete",
              label: "Delete Category (Guard)",
              icon: Trash2,
              destructive: true,
              separatorBefore: true,
              onSelect: () => setDeleteTarget(row),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumbs={[{ label: "Categories" }]}
        title="Category Management"
        description="Organize regional discovery categories across Malappuram, review linked destination totals, and test Add/Edit UI placeholders."
        badge={
          <Badge variant="accentSubtle" dot>
            {ADMIN_CATEGORY_RECORDS.length} Sample Groups
          </Badge>
        }
        actions={
          <Button type="button" size="sm" onClick={openAddDialog}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add Category
          </Button>
        }
      />

      <AdminSampleBanner
        title="Category Taxonomy (UI Placeholder Only):"
        description="Add Category and Edit Category dialogs demonstrate layout structure without mutating backend records."
      />

      {/* Category Overview Cards */}
      <section aria-labelledby="cat-overview-heading">
        <h2 id="cat-overview-heading" className="sr-only">
          Category overview metrics
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Total Categories"
            value={ADMIN_CATEGORY_RECORDS.length}
            icon={Layers}
            tone="primary"
            loading={tableMode === "loading"}
            footnote="4 primary Malappuram + 2 draft groups"
          />
          <StatCard
            title="Active Categories"
            value={activeCount}
            icon={CheckCircle2}
            tone="secondary"
            loading={tableMode === "loading"}
            footnote="Currently shown on public discovery"
          />
          <StatCard
            title="Linked Sample Destinations"
            value={totalLinked}
            icon={MapPin}
            tone="accent"
            loading={tableMode === "loading"}
            footnote="Across all active & draft categories"
          />
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">
          Filter category taxonomy rows or toggle table preview states.
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
                placeholder="Search category name, slug, description..."
              />
            }
            filtersSlot={
              <TableFilterBar
                hasActiveFilters={hasActiveFilters}
                onResetFilters={handleResetFilters}
                filters={[
                  {
                    id: "category-status-filter",
                    label: "Status",
                    value: statusFilter,
                    onValueChange: (val) => {
                      setStatusFilter(val);
                      setCurrentPage(1);
                    },
                    options: [
                      { value: "all", label: "All Statuses" },
                      { value: "active", label: "Active" },
                      { value: "inactive", label: "Inactive" },
                      { value: "pending", label: "Pending" },
                    ],
                  },
                ]}
              />
            }
          />

          <DataTable
            caption="Malappuram categories management sample table"
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
                ? "ERR_CATEGORY_PREVIEW_503: Simulated category directory load error."
                : undefined
            }
            onRetry={() => {
              setTableMode("data");
              adminToast.success(
                "Categories Restored",
                "Returned to sample category list view."
              );
            }}
            emptyTitle="No matching categories"
            emptyDescription="Clear active filters to restore the sample tourism categories."
            emptyAction={
              <Button type="button" size="sm" onClick={handleResetFilters}>
                Reset Filters
              </Button>
            }
          />

          {tableMode === "data" && filteredCategories.length > 0 && (
            <TablePagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={filteredCategories.length}
              pageSize={pageSize}
              itemLabel="sample categories"
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Category Placeholder Dialog */}
      <Dialog
        open={modalMode !== null}
        onOpenChange={(open) => {
          if (!open) setModalMode(null);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {modalMode === "edit"
                ? "Edit Category (UI Placeholder)"
                : "Add Category (UI Placeholder)"}
            </DialogTitle>
            <DialogDescription>
              Demonstrates category form layout using Task 03 components. No
              changes are persisted.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              const actionTitle =
                modalMode === "edit"
                  ? "Category Update (Preview Only)"
                  : "Category Creation (Preview Only)";
              setModalMode(null);
              adminToast.info(
                actionTitle,
                `"${draftName || "Sample Category"}" validated in UI preview without database storage.`
              );
            }}
            className="space-y-4 pt-2"
          >
            <AdminTextField
              id="cat-modal-name"
              label="Category Name"
              placeholder="e.g., Backwater Trails"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AdminTextField
                id="cat-modal-slug"
                label="URL Slug"
                placeholder="e.g., backwater-trails"
                value={draftSlug}
                onChange={(event) => setDraftSlug(event.target.value)}
              />
              <AdminSelectField
                id="cat-modal-status"
                label="Status"
                value={draftStatus}
                onValueChange={setDraftStatus}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                  { value: "pending", label: "Pending" },
                ]}
              />
            </div>
            <AdminTextareaField
              id="cat-modal-desc"
              label="Description"
              rows={3}
              placeholder="Short public description for category browsing pages..."
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalMode(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Preview Save (Non-Persistent)</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete sample category?"
        description="Confirmation protection preview. Category deletion is disabled in Task 04."
        targetLabel={deleteTarget?.name}
        variant="destructive"
        confirmLabel="Confirm Preview"
        onConfirm={() =>
          adminToast.info(
            "Category Guard Triggered (Preview)",
            `${deleteTarget?.name ?? "Category"} remains intact in sample data.`
          )
        }
      />
    </div>
  );
}
