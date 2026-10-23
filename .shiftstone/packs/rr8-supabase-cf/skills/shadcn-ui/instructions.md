
# shadcn/ui Component Skill

> Load this skill when adding, customizing, or consuming shadcn/ui components in React Router 8.

---

## 1. Directory Structure & Path Aliasing

In this framework, all shadcn/ui components live in `app/components/ui/` and use the `~/` path alias:

```typescript
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "~/components/ui/dropdown-menu";
```

---

## 2. Card Component Rules

In `app/components/ui/card.tsx`, large hover drop-shadows have been intentionally removed in favor of clean, structural borders:
- Keep borders subtle: `border border-border theme-card-bg`.
- Do NOT add `hover:shadow-2xl` unless explicitly requested.

---

## 3. Form Input OTP Integration

The framework integrates `input-otp` for 6-digit email OTP verification:

```tsx
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "~/components/ui/input-otp";

export function OtpVerificationInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <InputOTP maxLength={6} value={value} onChange={onChange}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  );
}
```

---

## 4. Best Practices & Rules

- **Radix UI Accessibility**: Ensure every interactive trigger (`DialogTrigger`, `SheetTrigger`, `DropdownMenuTrigger`) wraps an accessible button or sets `asChild`.
- **Icons**: Use `lucide-react` for icons with consistent sizing classes (`h-4 w-4`, `h-5 w-5`).
- **Toasts**: Use `sonner` for notifications: `import { toast } from "sonner"; toast.success("Saved successfully");`.
