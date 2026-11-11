import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
    <div>
      <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
      {subtitle && <p className="text-slate-600 dark:text-slate-400">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

export const LoadingBlock = () => (
  <div className="py-16 flex justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
  </div>
);

export const EmptyState = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children?: ReactNode }) => (
  <div className="py-14 text-center space-y-2">
    <Icon className="h-10 w-10 mx-auto text-slate-300" />
    <div className="font-medium text-slate-700 dark:text-slate-200">{title}</div>
    {children && <div className="text-sm text-slate-500 max-w-sm mx-auto">{children}</div>}
  </div>
);
