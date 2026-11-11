import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, Compass, Lock, Mail, User } from "lucide-react";
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
  title: "Register",
  description:
    "Structural registration form layout using Task 01 UI components. Account creation logic is excluded in Task 02.",
};

export default function RegisterPage() {
  return (
    <PageContainer spacing="default" className="space-y-8">
      <Breadcrumbs items={[{ label: "Register" }]} />

      <div className="mx-auto max-w-md space-y-6">
        <SampleDataNotice
          title="UI Layout Only"
          badgeText="No Auth Logic"
          message="User registration and persistence are excluded from Task 02. This form demonstrates structural validation layout only."
        />

        <Card>
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Compass className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="flex justify-center">
              <Badge variant="muted" size="sm">
                New Account Preview
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold">
              Create a My Travelroad Account
            </CardTitle>
            <CardDescription>
              Join to save Malappuram destinations and manage personal discovery preferences in upcoming releases.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="register-name">Full Name</Label>
              <Input
                id="register-name"
                name="fullName"
                type="text"
                placeholder="Enter your full name"
                startIcon={<User className="h-4 w-4" />}
                autoComplete="name"
              />
              <p className="text-xs text-text-secondary">
                Validation placeholder: Full name must be at least 2 characters.
              </p>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="register-email">Email Address</Label>
              <Input
                id="register-email"
                name="email"
                type="email"
                placeholder="traveler@example.com"
                startIcon={<Mail className="h-4 w-4" />}
                autoComplete="email"
              />
              <p className="text-xs text-text-secondary">
                Validation placeholder: Enter a valid email address.
              </p>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="register-password">Password</Label>
              <Input
                id="register-password"
                name="password"
                type="password"
                placeholder="Create a password"
                startIcon={<Lock className="h-4 w-4" />}
                autoComplete="new-password"
              />
              <p className="text-xs text-text-secondary">
                Validation placeholder: At least 8 characters with letters and numbers.
              </p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="register-confirm-password">Confirm Password</Label>
              <Input
                id="register-confirm-password"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                startIcon={<Lock className="h-4 w-4" />}
                autoComplete="new-password"
              />
              <p className="text-xs text-text-secondary">
                Validation placeholder: Passwords must match.
              </p>
            </div>

            {/* Validation Message Slot */}
            <div
              role="note"
              className="flex items-start gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-xs text-text-secondary"
            >
              <AlertCircle
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary"
                aria-hidden="true"
              />
              <span>
                Registration validation summary placeholder (surfaces field-level or duplicate-email messages in future tasks).
              </span>
            </div>

            {/* Terms Acceptance */}
            <div className="flex items-start space-x-2 pt-1">
              <Checkbox id="register-terms" className="mt-0.5" />
              <Label
                htmlFor="register-terms"
                className="text-xs leading-relaxed font-normal text-text-secondary cursor-pointer"
              >
                I agree to platform guidelines and responsible eco-tourism principles (structural checkbox placeholder).
              </Label>
            </div>

            <Button className="w-full" size="lg" disabled aria-disabled="true">
              Create Account (Structural Placeholder)
            </Button>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 border-t border-border bg-slate-50/50 px-6 py-4 text-center text-sm">
            <p className="text-text-secondary">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </PageContainer>
  );
}
