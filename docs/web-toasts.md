# Toasts (notifications) on the web

A toast tells the user, right after an action, whether it worked (ticket #57). The provider is mounted once in `apps/web/src/app/layout.tsx`; any client component below it can show one.

```tsx
import { useToast } from "@/components/toast/toast-provider";

const toast = useToast();

try {
  await api.delete(`/teams/${id}`);
  toast.success("Équipe supprimée.");
} catch (caught) {
  // Worded from the API's answer: 401, 403, a locked prediction, a
  // conflict explained in French, or a generic fallback
  toast.apiError(caught);
}
```

- `toast.success(message)` and `toast.info(message)` are said politely (`role="status"`) and fade after 5 seconds, unless the pointer or the keyboard focus is on them.
- `toast.error(message)` and `toast.apiError(caught, fallback?)` are said at once (`role="alert"`) and stay until the user closes them (close button, or Escape inside the toast).
- A toast never takes the focus. It always has an icon and words, never the color alone.
- Forms built with `useApiForm` show toasts by themselves: return the success message from the submit action, errors are handled for you. Field errors still show under their fields; the form-level message under the form is not announced again, since the toast already is.

Do not use a toast for live updates pushed by the server (stream events): they would flood the user. A page announces those in its own polite `aria-live` region, one sentence per update.

Write toast messages like the rest of the interface (`docs/CHARTE.md`, Contenu et ton): short, in French, tutoiement, and for an error, what happened and how to fix it.
