"use client";

import * as React from "react";
import Link from "next/link";
import {
  Archive,
  Eye,
  Pencil,
  Plus,
  ShieldCheck,
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
import {
  StatusBadge,
  VerificationStatusBadge,
} from "@/components/admin/status/status-badge";
import { AdminSearchInput } from "@/components/admin/tables/admin-search-input";
import { TableFilterBar } from "@/components/admin/tables/table-filters";
import { TableToolbar } from "@/components/admin/tables/table-toolbar";
import { BulkSelectionBar } from "@/components/admin/tables/bulk-selection-checkbox";
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
  ADMIN_DESTINATION_RECORDS,
  type AdminSampleDestinationRow,
} from "@/data/admin-sample-data";

export function DestinationsClient() {
  const {
    tableMode,
    setTableMode,
    searchQuery,
    setSearchQuery,
    sortKey,
    sortDirection,
    handleSortChange,
    setCurrentPage,
    selectedIds,
    setSelectedIds,
    paginateRows,
  } = useAdminTableState({
    initialSortKey: "name",
    pageSize: 5,
  });

  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [destModalMode, setDestModalMode] = React.useState<"add" | "edit" | null>(null);
  const [editingDestination, setEditingDestination] =
    React.useState<AdminSampleDestinationRow | null>(null);
  const [draftName, setDraftName] = React.useState("");
  const [draftCategory, setDraftCategory] = React.useState("Nature & Forests");
  const [draftRegion, setDraftRegion] = React.useState("");
  const [draftNotes, setDraftNotes] = React.useState("");

  const openAddModal = () => {
    setDraftName("");
    setDraftCategory("Nature & Forests");
    setDraftRegion("");
    setDraftNotes("");
    setEditingDestination(null);
    setDestModalMode("add");
  };

  const openEditModal = (dest: AdminSampleDestinationRow) => {
    setDraftName(dest.name);
    setDraftCategory(dest.category);
    setDraftRegion(dest.region);
    setDraftNotes(
      `Verified regional listing curated by ${dest.submittedBy}. Last updated ${dest.updatedAt}.`
    );
    setEditingDestination(dest);
    setDestModalMode("edit");
  };

  const [confirmState, setConfirmState] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    targetLabel?: string;
    confirmLabel: string;
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
  });

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    categoryFilter !== "all" ||
    statusFilter !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setCurrentPage(1);
    setTableMode("data");
  };

  const filteredRows = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ADMIN_DESTINATION_RECORDS.filter((row) => {
      const matchesQuery =
        !query ||
        row.name.toLowerCase().includes(query) ||
        row.region.toLowerCase().includes(query) ||
        row.submittedBy.toLowerCase().includes(query);
      const matchesCategory =
        categoryFilter === "all" || row.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter;
      return matchesQuery && matchesCategory && matchesStatus;
    }).sort((a, b) => {
      const valA =
        sortKey === "category"
          ? a.category
          : sortKey === "status"
          ? a.status
          : a.name;
      const valB =
        sortKey === "category"
          ? b.category
          : sortKey === "status"
          ? b.status
          : b.name;
      const comparison = valA.localeCompare(valB);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [searchQuery, categoryFilter, statusFilter, sortKey, sortDirection]);

  const { totalPages, safePage, pageSize, paginatedRows } =
    paginateRows(filteredRows);

  const columns: DataTableColumn<AdminSampleDestinationRow>[] = [
    {
      key: "name",
      header: "Destination (Sample)",
      mobileLabel: "Destination",
      mobileRole: "primary",
      sortable: true,
      cell: (row) => (
        <div className="md:min-w-[180px] space-y-0.5">
          <p className="font-semibold text-text-primary leading-snug">
            {row.name}
          </p>
          <p className="text-xs text-text-secondary">{row.region}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      mobileRole: "secondary",
      sortable: true,
      cell: (row) => (
        <span className="text-xs sm:text-sm text-text-secondary md:whitespace-nowrap">
          {row.category}
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
      key: "verification",
      header: "Verification",
      mobileRole: "status",
      cell: (row) => (
        <VerificationStatusBadge state={row.verificationStatus} size="sm" />
      ),
    },
    {
      key: "updated",
      header: "Curator / Updated",
      mobileLabel: "Curator & Updated",
      mobileRole: "secondary",
      cell: (row) => (
        <div className="text-xs text-text-secondary md:whitespace-nowrap">
          <span className="font-medium text-text-primary">{row.submittedBy}</span>
          <span className="block text-[11px]">{row.updatedAt}</span>
        </div>
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
              id: "inspect",
              label: "Inspect Listing (Preview)",
              icon: Eye,
              onSelect: () =>
                adminToast.info(
                  row.name,
                  `${row.region} • Status: ${row.status} (Sample preview only)`
                ),
            },
            {
              id: "edit",
              label: "Edit Destination (Placeholder)",
              icon: Pencil,
              onSelect: () => openEditModal(row),
            },
            {
              id: "verify",
              label: "Review in Verification",
              icon: ShieldCheck,
              onSelect: () =>
                adminToast.info(
                  "Queued for Verification Preview",
                  `${row.name} maps to the Verification Queue layout.`
                ),
            },
            {
              id: "delete",
              label: "Delete Entry (Guard)",
              icon: Trash2,
              destructive: true,
              separatorBefore: true,
              onSelect: () =>
                setConfirmState({
                  open: true,
                  title: "Delete sample destination entry?",
                  description:
                    "Confirmation dialog guard preview. Confirming triggers feedback toast without deleting any record.",
                  targetLabel: row.name,
                  confirmLabel: "Delete Preview",
                }),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumbs={[{ label: "Destinations" }]}
        title="Destination Management"
        description="Browse, search, filter, and inspect Malappuram tourism destination records. Create, edit, and delete controls are structural UI placeholders only."
        badge={
          <Badge variant="accentSubtle" dot>
            {ADMIN_DESTINATION_RECORDS.length} Sample Rows
          </Badge>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/destination-verification">
                <ShieldCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Verification Queue
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={openAddModal}
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Add Destination
            </Button>
          </>
        }
      />

      <AdminSampleBanner
        title="Destination Directory (No CRUD Persistence):"
        description="Search, sorting, category/status filters, and pagination run on in-memory Malappuram sample listings. Add Destination and row actions show UI previews only."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">
          Switch between populated data, loading skeletons, empty state, and
          error state layouts.
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
                placeholder="Search destination, region, curator..."
              />
            }
            filtersSlot={
              <TableFilterBar
                hasActiveFilters={hasActiveFilters}
                onResetFilters={handleResetFilters}
                filters={[
                  {
                    id: "dest-category-filter",
                    label: "Category",
                    value: categoryFilter,
                    onValueChange: (val) => {
                      setCategoryFilter(val);
                      setCurrentPage(1);
                    },
                    options: [
                      { value: "all", label: "All Categories" },
                      { value: "Nature & Forests", label: "Nature & Forests" },
                      { value: "Beaches & Estuaries", label: "Beaches & Estuaries" },
                      { value: "Waterfalls & Hills", label: "Waterfalls & Hills" },
                      { value: "Heritage & Culture", label: "Heritage & Culture" },
                    ],
                  },
                  {
                    id: "dest-status-filter",
                    label: "Status",
                    value: statusFilter,
                    onValueChange: (val) => {
                      setStatusFilter(val);
                      setCurrentPage(1);
                    },
                    options: [
                      { value: "all", label: "All Statuses" },
                      { value: "active", label: "Active" },
                      { value: "approved", label: "Approved" },
                      { value: "pending", label: "Pending" },
                      { value: "inactive", label: "Inactive" },
                      { value: "rejected", label: "Rejected" },
                      { value: "suspended", label: "Suspended" },
                    ],
                  },
                ]}
              />
            }
            bulkSelectionSlot={
              <BulkSelectionBar
                selectedCount={selectedIds.length}
                onClearSelection={() => setSelectedIds([])}
                actions={
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      setConfirmState({
                        open: true,
                        title: `Archive ${selectedIds.length} selected destinations?`,
                        description:
                          "Demonstrates bulk confirmation guard before batch state transitions.",
                        targetLabel: `${selectedIds.length} checked sample rows`,
                        confirmLabel: "Archive Preview",
                      })
                    }
                  >
                    <Archive className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Archive Selected
                  </Button>
                }
              />
            }
          />

          <DataTable
            caption="Malappuram destinations management sample table"
            data={tableMode === "empty" ? [] : paginatedRows}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.name}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            isLoading={tableMode === "loading"}
            errorMessage={
              tableMode === "error"
                ? "ERR_DEST_PREVIEW_503: Simulated destination catalog retrieval issue."
                : undefined
            }
            onRetry={() => {
              setTableMode("data");
              adminToast.success(
                "Sample Table Restored",
                "Destination list preview restored cleanly."
              );
            }}
            emptyTitle="No matching destinations found"
            emptyDescription="Try clearing active search or category filters to inspect the sample Malappuram directory."
            emptyAction={
              <Button type="button" size="sm" onClick={handleResetFilters}>
                Reset Filters
              </Button>
            }
          />

          {tableMode === "data" && filteredRows.length > 0 && (
            <TablePagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={filteredRows.length}
              pageSize={pageSize}
              itemLabel="sample destinations"
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Non-persistent Add / Edit Destination UI Placeholder Modal */}
      <Dialog
        open={destModalMode !== null}
        onOpenChange={(open) => {
          if (!open) setDestModalMode(null);
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {destModalMode === "edit"
                ? "Edit Destination (UI Placeholder)"
                : "Add Destination (UI Placeholder)"}
            </DialogTitle>
            <DialogDescription>
              {destModalMode === "edit"
                ? `Form pre-filled with sample listing data for ${editingDestination?.name ?? "destination"}. No records will be modified.`
                : "Form structure demonstrating Task 03 fields. Submitting displays confirmation feedback without creating database records."}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              const isEdit = destModalMode === "edit";
              const targetName = draftName || editingDestination?.name || "Sample Destination";
              setDestModalMode(null);
              adminToast.info(
                isEdit ? "Edit Destination (Preview Only)" : "Add Destination (Preview Only)",
                `"${targetName}" validated in UI preview. Database CRUD is excluded.`
              );
            }}
            className="space-y-4 pt-2"
          >
            <AdminTextField
              id="modal-dest-name"
              label="Destination Name"
              placeholder="e.g., Nilambur Bamboo Reserve"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AdminSelectField
                id="modal-dest-cat"
                label="Category"
                value={draftCategory}
                onValueChange={setDraftCategory}
                options={[
                  { value: "Nature & Forests", label: "Nature & Forests" },
                  { value: "Beaches & Estuaries", label: "Beaches & Estuaries" },
                  { value: "Waterfalls & Hills", label: "Waterfalls & Hills" },
                  { value: "Heritage & Culture", label: "Heritage & Culture" },
                ]}
              />
              <AdminTextField
                id="modal-dest-region"
                label="Taluk / Area"
                placeholder="e.g., Nilambur, Eastern Zone"
                value={draftRegion}
                onChange={(event) => setDraftRegion(event.target.value)}
              />
            </div>
            <AdminTextareaField
              id="modal-dest-notes"
              label="Curator Notes"
              rows={3}
              placeholder="Seasonal access guidance or landmark highlights..."
              value={draftNotes}
              onChange={(event) => setDraftNotes(event.target.value)}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDestModalMode(null)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {destModalMode === "edit" ? "Save Changes (Preview)" : "Preview Submit (Non-Persistent)"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) =>
          setConfirmState((prev) => ({ ...prev, open }))
        }
        title={confirmState.title}
        description={confirmState.description}
        targetLabel={confirmState.targetLabel}
        variant="destructive"
        confirmLabel={confirmState.confirmLabel}
        onConfirm={() =>
          adminToast.info(
            "Action Guard Completed (Preview)",
            `${confirmState.targetLabel ?? "Selection"} remains unchanged in sample state.`
          )
        }
      />
    </div>
  );
}
