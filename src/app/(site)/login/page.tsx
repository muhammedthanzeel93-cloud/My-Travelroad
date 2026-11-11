import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, Compass, Lock, Mail } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SampleDataNotice } from "@/components/tourism/sample-data-notice";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Structural login form layout using Task 01 UI components. Authentication logic is excluded in Task 02.",
};

export default function LoginPage() {
  return (
    <PageContainer spacing="default" className="space-y-8">
      <Breadcrumbs items={[{ label: "Sign In" }]} />

      <div className="mx-auto max-w-md space-y-6">
        <SampleDataNotice
          title="UI Layout Only"
          badgeText="No Auth Logic"
          message="Authentication is excluded from Task 02. Inputs and submit actions represent structural form placeholders."
        />

        <Card>
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Compass className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="flex justify-center">
              <Badge variant="muted" size="sm">
                Account Preview
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold">
              Sign in to My Travelroad
            </CardTitle>
            <CardDescription>
              Access your saved Malappuram spots and profile preferences once authentication is implemented.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="login-email">Email Address</Label>
              <Input
                id="login-email"
                name="email"
                type="email"
                placeholder="traveler@example.com"
                startIcon={<Mail className="h-4 w-4" />}
                autoComplete="email"
              />
              <p className="text-xs text-text-secondary">
                Validation placeholder: Must be a valid email format.
              </p>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Password</Label>
                <span className="text-xs text-text-secondary">
                  Reset password (placeholder)
                </span>
              </div>
              <Input
                id="login-password"
                name="password"
                type="password"
                placeholder="Enter your password"
                startIcon={<Lock className="h-4 w-4" />}
                autoComplete="current-password"
              />
              <p className="text-xs text-text-secondary">
                Validation placeholder: Minimum 8 characters required.
              </p>
            </div>

            {/* Validation Message Slot Example */}
            <div
              role="note"
              className="flex items-start gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-xs text-text-secondary"
            >
              <AlertCircle
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary"
                aria-hidden="true"
              />
              <span>
                Validation feedback area placeholder (displays inline credential or server errors in future auth integration).
              </span>
            </div>

            {/* Remember Me */}
            <div className="flex items-center space-x-2">
              <Checkbox id="login-remember" />
              <Label
                htmlFor="login-remember"
                className="text-sm font-normal text-text-secondary cursor-pointer"
              >
                Keep me signed in on this device (placeholder)
              </Label>
            </div>

            <Button className="w-full" size="lg" disabled aria-disabled="true">
              Sign In (Structural Placeholder)
            </Button>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t border-border bg-slate-50/50 px-6 py-4 text-center text-sm">
            <p className="text-text-secondary">
              Don&apos;t have an account yet?{" "}
              <Link
                href="/register"
                className="font-semibold text-primary hover:underline"
              >
                Create an account
              </Link>
            </p>
            <Link
              href="/profile"
              className="text-xs text-text-secondary hover:text-primary hover:underline"
            >
              Inspect sample traveler profile layout
            </Link>
          </CardFooter>
        </Card>
      </div>
    </PageContainer>
  );
}
