import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import type { ThemeMode } from "../app-types";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <article className="stat-card elevated-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

export function ThemeToggle({
  theme,
  onChange,
}: {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
}) {
  return (
    <div className="theme-toggle" role="tablist" aria-label="Theme selector">
      <button
        className={`theme-option ${theme === "dark" ? "active" : ""}`}
        onClick={() => onChange("dark")}
      >
        <Moon size={16} />
        Dark
      </button>
      <button
        className={`theme-option ${theme === "light" ? "active" : ""}`}
        onClick={() => onChange("light")}
      >
        <Sun size={16} />
        Light
      </button>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header elevated-card">
      <div className="page-header-copy">
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}

export function EmptyStateCard({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="empty-state-card elevated-card">
      <div className="empty-state-copy">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {actions ? <div className="empty-state-actions">{actions}</div> : null}
    </div>
  );
}

export function compactPath(value: string, keep = 52) {
  if (!value || value.length <= keep) {
    return value;
  }

  const normalized = value.replace(/\//g, "\\");
  const segments = normalized.split("\\").filter(Boolean);
  if (segments.length <= 3) {
    return `${normalized.slice(0, keep - 1)}…`;
  }

  const first = segments.slice(0, 2).join("\\");
  const last = segments.slice(-2).join("\\");
  const candidate = `${first}\\…\\${last}`;
  if (candidate.length <= keep + 6) {
    return candidate;
  }
  return `${normalized.slice(0, Math.max(keep - 1, 12))}…`;
}

export function PathValue({
  path,
  subtle,
}: {
  path: string;
  subtle?: boolean;
}) {
  return (
    <code className={`path-value ${subtle ? "subtle" : ""}`} title={path}>
      {compactPath(path)}
    </code>
  );
}
