import Link from "next/link";

const VARIANT_CLASSES = {
  primary: "bg-accent text-white hover:brightness-95",
  secondary: "bg-white text-navy border border-slate-300 hover:bg-slate-50",
} as const;

const baseClasses = "inline-flex items-center justify-center rounded px-3 py-2 text-sm font-medium transition disabled:opacity-50 w-fit";

export default function Button({
  children,
  href,
  variant = "primary",
  className,
  ...rest
}: {
  children: React.ReactNode;
  href?: string;
  variant?: keyof typeof VARIANT_CLASSES;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = `${baseClasses} ${VARIANT_CLASSES[variant]} ${className ?? ""}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
