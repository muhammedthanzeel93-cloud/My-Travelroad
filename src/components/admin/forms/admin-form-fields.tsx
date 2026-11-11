"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input, type InputProps } from "@/components/ui/input";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";

interface BaseFieldProps {
  id: string;
  label: string;
  description?: string;
  errorMessage?: string;
  required?: boolean;
  className?: string;
}

function FieldWrapper({
  id,
  label,
  description,
  errorMessage,
  required,
  className,
  children,
}: BaseFieldProps & { children: React.ReactNode }) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = errorMessage ? `${id}-error` : undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="flex items-center gap-1">
        <span>{label}</span>
        {required && (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>

      {children}

      {description && !errorMessage && (
        <p id={descriptionId} className="text-xs text-text-secondary leading-relaxed">
          {description}
        </p>
      )}

      {errorMessage && (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-xs font-medium text-destructive"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </p>
      )}
    </div>
  );
}

export interface AdminTextFieldProps
  extends BaseFieldProps,
    Omit<InputProps, "id" | "error"> {}

/** Standardized admin text input reusing Task 01 Label & Input with accessible error wiring. */
export function AdminTextField({
  id,
  label,
  description,
  errorMessage,
  required,
  className,
  ...inputProps
}: AdminTextFieldProps) {
  const describedBy = errorMessage
    ? `${id}-error`
    : description
    ? `${id}-description`
    : undefined;

  return (
    <FieldWrapper
      id={id}
      label={label}
      description={description}
      errorMessage={errorMessage}
      required={required}
      className={className}
    >
      <Input
        id={id}
        error={Boolean(errorMessage)}
        aria-invalid={Boolean(errorMessage)}
        aria-required={required}
        aria-describedby={describedBy}
        {...inputProps}
      />
    </FieldWrapper>
  );
}

export interface AdminTextareaFieldProps
  extends BaseFieldProps,
    Omit<TextareaProps, "id" | "error"> {}

/** Standardized admin multiline textarea reusing Task 01 Label & Textarea. */
export function AdminTextareaField({
  id,
  label,
  description,
  errorMessage,
  required,
  className,
  ...textareaProps
}: AdminTextareaFieldProps) {
  const describedBy = errorMessage
    ? `${id}-error`
    : description
    ? `${id}-description`
    : undefined;

  return (
    <FieldWrapper
      id={id}
      label={label}
      description={description}
      errorMessage={errorMessage}
      required={required}
      className={className}
    >
      <Textarea
        id={id}
        error={Boolean(errorMessage)}
        aria-invalid={Boolean(errorMessage)}
        aria-required={required}
        aria-describedby={describedBy}
        {...textareaProps}
      />
    </FieldWrapper>
  );
}

export interface AdminSelectOption {
  value: string;
  label: string;
}

export interface AdminSelectFieldProps extends BaseFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  options: AdminSelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

/** Standardized admin select field built on Task 01 Select primitives. */
export function AdminSelectField({
  id,
  label,
  description,
  errorMessage,
  required,
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
  disabled = false,
  className,
}: AdminSelectFieldProps) {
  const describedBy = errorMessage
    ? `${id}-error`
    : description
    ? `${id}-description`
    : undefined;

  return (
    <FieldWrapper
      id={id}
      label={label}
      description={description}
      errorMessage={errorMessage}
      required={required}
      className={className}
    >
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          error={Boolean(errorMessage)}
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={describedBy}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

export interface AdminCheckboxFieldProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** Admin checkbox row with paired accessible label and helper note. */
export function AdminCheckboxField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: AdminCheckboxFieldProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-surface p-3.5",
        className
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(val) => onCheckedChange(val === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="space-y-1">
        <Label htmlFor={id} className="cursor-pointer font-medium">
          {label}
        </Label>
        {description && (
          <p className="text-xs text-text-secondary leading-relaxed">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export interface AdminRadioOption {
  value: string;
  label: string;
  description?: string;
}

export interface AdminRadioGroupFieldProps {
  id: string;
  label: string;
  description?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: AdminRadioOption[];
  disabled?: boolean;
  className?: string;
}

/** Accessible admin radio-group control reusing Task 01 RadioGroup primitives. */
export function AdminRadioGroupField({
  id,
  label,
  description,
  value,
  onValueChange,
  options,
  disabled = false,
  className,
}: AdminRadioGroupFieldProps) {
  return (
    <fieldset className={cn("space-y-2.5", className)} disabled={disabled}>
      <legend className="text-sm font-medium text-text-primary">{label}</legend>
      {description && (
        <p className="text-xs text-text-secondary">{description}</p>
      )}
      <RadioGroup
        value={value}
        onValueChange={onValueChange}
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
      >
        {options.map((opt) => {
          const itemId = `${id}-${opt.value}`;
          return (
            <label
              key={opt.value}
              htmlFor={itemId}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors",
                value === opt.value
                  ? "border-primary bg-primary/[0.04]"
                  : "border-border bg-surface hover:bg-slate-50"
              )}
            >
              <RadioGroupItem
                id={itemId}
                value={opt.value}
                className="mt-0.5 shrink-0"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium text-text-primary">
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="block text-xs text-text-secondary">
                    {opt.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}

export interface AdminSwitchFieldProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** Toggle row for binary admin configuration controls built on Task 01 Switch. */
export function AdminSwitchField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: AdminSwitchFieldProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-3.5",
        className
      )}
    >
      <div className="space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer font-medium">
          {label}
        </Label>
        {description && (
          <p className="text-xs text-text-secondary leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}
