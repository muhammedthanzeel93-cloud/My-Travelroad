import { toast } from "sonner";

/**
 * Standardized admin toast wrapper delegating rendering to the global Task 01
 * <Toaster /> mounted in src/app/layout.tsx.
 */
export const adminToast = {
  success(title: string, description?: string) {
    return toast.success(title, { description });
  },
  info(title: string, description?: string) {
    return toast.info(title, { description });
  },
  warning(title: string, description?: string) {
    return toast.warning(title, { description });
  },
  error(title: string, description?: string) {
    return toast.error(title, { description });
  },
  placeholder(moduleName: string) {
    return toast.info(`${moduleName} (Task 03 Preview Only)`, {
      description:
        "This navigation item is a structural placeholder. Management workflows will be implemented in later tasks.",
    });
  },
};
