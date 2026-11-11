import type { ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";

interface Props extends Omit<ButtonProps, "onClick" | "title"> {
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  children: ReactNode;
}

/** A button that asks "are you sure?" before doing something destructive. */
export const ConfirmButton = ({ title, description, confirmLabel = "Yes, continue", onConfirm, children, ...btn }: Props) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button {...btn}>{children}</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Go back</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
