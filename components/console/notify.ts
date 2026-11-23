import { toast, type ExternalToast } from "sonner";

// Owner: Samuel (console). Console toasts appear at the top of the screen:
// the bottom belongs to the big buttons and the Undo bar, and a toast there
// would sit under the official's thumb.
const top = (options?: ExternalToast): ExternalToast => ({ position: "top-center", ...options });

export const notify = {
  message: (text: string, options?: ExternalToast) => toast(text, top(options)),
  success: (text: string, options?: ExternalToast) => toast.success(text, top(options)),
  error: (text: string, options?: ExternalToast) => toast.error(text, top(options)),
};
