import { Link } from "react-router-dom";
import type { ReactNode } from "react";

interface ToolCardProps {
  to: string;
  title: string;
  description: string;
  icon: ReactNode;
}

export default function ToolCard({ to, title, description, icon }: ToolCardProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
    </Link>
  );
}
