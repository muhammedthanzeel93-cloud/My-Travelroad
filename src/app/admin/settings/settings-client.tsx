"use client";

import * as React from "react";
import {
  Bell,
  KeyRound,
  LogOut,
  RotateCcw,
  Save,
  ShieldAlert,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminSampleBanner } from "@/components/admin/feedback/admin-sample-banner";
import { ConfirmDialog } from "@/components/admin/feedback/confirm-dialog";
import { adminToast } from "@/components/admin/feedback/admin-toast";
import {
  AdminFormActions,
  AdminFormSection,
} from "@/components/admin/forms/admin-form-section";
import {
  AdminCheckboxField,
  AdminRadioGroupField,
  AdminSelectField,
  AdminSwitchField,
  AdminTextField,
  AdminTextareaField,
} from "@/components/admin/forms/admin-form-fields";
import {
  ADMIN_SAMPLE_USER,
  ADMIN_SETTINGS_DEFAULTS,
  type AdminSampleSettingsState,
} from "@/data/admin-sample-data";

export function SettingsClient() {
  const [formState, setFormState] = React.useState<AdminSampleSettingsState>(
    ADMIN_SETTINGS_DEFAULTS
  );
  const [confirmSecurityDialog, setConfirmSecurityDialog] =
    React.useState(false);

  const handleResetDefaults = () => {
    setFormState(ADMIN_SETTINGS_DEFAULTS);
    adminToast.info(
      "Sample Settings Reset",
      "All local UI controls restored to Task 04 default sample values."
    );
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumbs={[{ label: "Settings" }]}
        title="Admin Settings"
        description="Configure administrator profile details, Malappuram workspace metadata, notifications, table display preferences, and security UI placeholders."
        badge={
          <Badge variant="accentSubtle" dot>
            Local UI State Only
          </Badge>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Reset Sample Defaults
          </Button>
        }
      />

      <AdminSampleBanner
        title="Settings Workspace (Non-Persistent Preview):"
        description="Toggles and fields update local browser state for visual verification. Account profile updates and security controls require backend authentication."
      />

      <div className="space-y-6">
        {/* 1. Admin Profile */}
        <section id="profile" aria-labelledby="settings-profile-heading">
          <h2 id="settings-profile-heading" className="sr-only">
            Admin Profile Settings
          </h2>
          <AdminFormSection
            title="Admin Profile"
            description="Sample curator identity surfaced in the top admin account menu."
            badge={
              <Badge variant="subtle" size="sm">
                Preview Identity
              </Badge>
            }
            footer={
              <AdminFormActions>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    adminToast.info(
                      "Profile Save (Placeholder)",
                      `Local preview checked for "${formState.profileName}". No backend user record updated.`
                    )
                  }
                >
                  <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Save Profile (Placeholder)
                </Button>
              </AdminFormActions>
            }
          >
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <Avatar size="lg" status={ADMIN_SAMPLE_USER.status}>
                  <AvatarFallback>{ADMIN_SAMPLE_USER.initials}</AvatarFallback>
                </Avatar>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-text-primary">
                    {formState.profileName} (Sample)
                  </p>
                  <p className="text-xs text-text-secondary">
                    {ADMIN_SAMPLE_USER.role} &bull; UI Preview Mode
                  </p>
                </div>
              </div>
              <Badge variant="muted" size="sm" className="self-start sm:self-center">
                Auth Not Integrated
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <AdminTextField
                id="settings-profile-name"
                label="Display Name"
                value={formState.profileName}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    profileName: e.target.value,
                  }))
                }
                description="Shown beside activity and verification notes."
              />
              <AdminTextField
                id="settings-profile-email"
                label="Notification Email"
                type="email"
                value={formState.profileEmail}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    profileEmail: e.target.value,
                  }))
                }
                description="Sample administrative email placeholder."
              />
            </div>

            <AdminTextareaField
              id="settings-profile-bio"
              label="Curator Bio & Coverage Area"
              rows={3}
              value={formState.profileBio}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  profileBio: e.target.value,
                }))
              }
            />
          </AdminFormSection>
        </section>

        {/* 2. Workspace Information */}
        <section id="workspace" aria-labelledby="settings-workspace-heading">
          <h2 id="settings-workspace-heading" className="sr-only">
            Workspace Information Settings
          </h2>
          <AdminFormSection
            title="Workspace Information"
            description="Regional tourism scope and editorial defaults for My Travelroad."
            badge={
              <Badge variant="secondarySubtle" size="sm">
                Malappuram First
              </Badge>
            }
            footer={
              <AdminFormActions>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    adminToast.info(
                      "Workspace Save (Placeholder)",
                      "Workspace metadata changes are local UI previews only."
                    )
                  }
                >
                  <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Save Workspace (Placeholder)
                </Button>
              </AdminFormActions>
            }
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <AdminTextField
                id="settings-workspace-name"
                label="Platform Name"
                value={formState.workspaceName}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    workspaceName: e.target.value,
                  }))
                }
              />
              <AdminSelectField
                id="settings-launch-region"
                label="Primary Launch District"
                value={formState.launchRegion}
                onValueChange={(val) =>
                  setFormState((prev) => ({ ...prev, launchRegion: val }))
                }
                options={[
                  { value: "malappuram", label: "Malappuram, Kerala (Active Launch)" },
                  { value: "kozhikode", label: "Kozhikode (Future Expansion)" },
                  { value: "palakkad", label: "Palakkad (Future Expansion)" },
                ]}
              />
              <AdminTextField
                id="settings-support-email"
                label="Curation Support Desk Email"
                type="email"
                value={formState.supportEmail}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    supportEmail: e.target.value,
                  }))
                }
              />
            </div>

            <AdminTextareaField
              id="settings-moderation-note"
              label="Default Verification Checklist Note"
              rows={3}
              value={formState.moderationNote}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  moderationNote: e.target.value,
                }))
              }
            />
          </AdminFormSection>
        </section>

        {/* 3. Notification Preferences */}
        <section id="notifications" aria-labelledby="settings-notify-heading">
          <h2 id="settings-notify-heading" className="sr-only">
            Notification Preferences
          </h2>
          <AdminFormSection
            title="Notification Preferences"
            description="Control how sample alerts appear in the top notification menu and digest previews."
            badge={
              <Badge variant="muted" size="sm">
                <Bell className="mr-1 h-3 w-3" aria-hidden="true" />
                Alert Routing
              </Badge>
            }
            footer={
              <AdminFormActions>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    adminToast.success(
                      "Notification Preview Updated",
                      "Local notification toggle states recorded in preview memory only."
                    )
                  }
                >
                  Save Preferences (Placeholder)
                </Button>
              </AdminFormActions>
            }
          >
            <div className="space-y-3">
              <AdminSwitchField
                id="notify-submissions"
                label="New Destination Submissions"
                description="Highlight newly submitted Malappuram tourism spots in the admin bell drawer."
                checked={formState.notifyNewSubmissions}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    notifyNewSubmissions: checked,
                  }))
                }
              />
              <AdminSwitchField
                id="notify-verification"
                label="Verification Queue Escalations"
                description="Flag sample entries waiting in Needs Update or In Review states."
                checked={formState.notifyVerificationQueue}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    notifyVerificationQueue: checked,
                  }))
                }
              />
              <AdminCheckboxField
                id="notify-flagged-reviews"
                label="Alert on Flagged Traveler Reviews"
                description="Surface potentially duplicate or inappropriate review excerpts in moderation notices."
                checked={formState.notifyFlaggedReviews}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    notifyFlaggedReviews: checked,
                  }))
                }
              />
              <AdminCheckboxField
                id="notify-weekly-digest"
                label="Include Weekly Reports Summary"
                description="Receive illustrative weekly destination growth metrics (sample digest placeholder)."
                checked={formState.weeklyReportDigest}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    weeklyReportDigest: checked,
                  }))
                }
              />
            </div>
          </AdminFormSection>
        </section>

        {/* 4. Display Preferences */}
        <section id="display" aria-labelledby="settings-display-heading">
          <h2 id="settings-display-heading" className="sr-only">
            Display Preferences
          </h2>
          <AdminFormSection
            title="Display Preferences"
            description="Layout density and table pagination defaults for administrative workspaces."
            footer={
              <AdminFormActions>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    adminToast.info(
                      "Display Preferences (Placeholder)",
                      `Selected ${formState.tableDensity} density & ${formState.defaultPageSize} rows per page.`
                    )
                  }
                >
                  Apply Display Preview
                </Button>
              </AdminFormActions>
            }
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <AdminSelectField
                id="display-page-size"
                label="Default Table Page Size"
                value={formState.defaultPageSize}
                onValueChange={(val) =>
                  setFormState((prev) => ({ ...prev, defaultPageSize: val }))
                }
                options={[
                  { value: "5", label: "5 rows per page" },
                  { value: "10", label: "10 rows per page" },
                  { value: "20", label: "20 rows per page" },
                ]}
              />

              <AdminSwitchField
                id="display-sample-badges"
                label="Show Development Sample Badges"
                description="Keep sample data and preview indicators clearly visible across admin pages."
                checked={formState.showSampleBadges}
                onCheckedChange={(checked) =>
                  setFormState((prev) => ({
                    ...prev,
                    showSampleBadges: checked,
                  }))
                }
              />
            </div>

            <AdminRadioGroupField
              id="display-table-density"
              label="Table & Card Density"
              description="Choose visual spacing rhythm for management tables."
              value={formState.tableDensity}
              onValueChange={(val) =>
                setFormState((prev) => ({
                  ...prev,
                  tableDensity: val as "comfortable" | "compact",
                }))
              }
              options={[
                {
                  value: "comfortable",
                  label: "Comfortable (Recommended)",
                  description: "Generous vertical cell padding matching Task 03 tokens.",
                },
                {
                  value: "compact",
                  label: "Compact Grid",
                  description: "Higher row density for high-volume curation audits.",
                },
              ]}
            />
          </AdminFormSection>
        </section>

        {/* 5. Security Settings Placeholder */}
        <section id="security" aria-labelledby="settings-security-heading">
          <h2 id="settings-security-heading" className="sr-only">
            Security Settings Placeholder
          </h2>
          <AdminFormSection
            title="Security & Access Controls (Placeholder)"
            description="Authentication, MFA, and RBAC session policies are deferred to future backend tasks."
            badge={
              <Badge variant="accentSubtle" size="sm">
                <ShieldAlert className="mr-1 h-3 w-3" aria-hidden="true" />
                Not Active Yet
              </Badge>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-slate-50/70 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-text-primary">
                    Two-Factor Authentication (MFA)
                  </span>
                  <Badge variant="muted" size="sm">
                    Planned
                  </Badge>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Admin login & hardware/TOTP enforcement will connect here once
                  authentication is introduced.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    adminToast.info(
                      "Security Placeholder",
                      "MFA enrollment is excluded in Task 04 UI structure."
                    )
                  }
                >
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Configure MFA (Placeholder)
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-slate-50/70 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-text-primary">
                    Active Console Session Guard
                  </span>
                  <Badge variant="secondarySubtle" size="sm">
                    Preview
                  </Badge>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Demonstrates session sign-out confirmation protection before
                  clearing an authenticated session.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmSecurityDialog(true)}
                >
                  <LogOut className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Test Session Sign Out Guard
                </Button>
              </div>
            </div>
          </AdminFormSection>
        </section>
      </div>

      <ConfirmDialog
        open={confirmSecurityDialog}
        onOpenChange={setConfirmSecurityDialog}
        title="Sign out of Admin Sessions (Preview)?"
        description="Security confirmation guard preview. Real session invalidation requires backend auth."
        targetLabel={ADMIN_SAMPLE_USER.email}
        variant="warning"
        confirmLabel="Simulate Sign Out"
        onConfirm={() =>
          adminToast.info(
            "Security Action Preview Completed",
            "No real session token exists in Task 04."
          )
        }
      />
    </div>
  );
}
