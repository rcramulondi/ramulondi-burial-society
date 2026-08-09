import Link from "next/link";

const VARIANT_CLASSES = {
  primary: "bg-accent text-white border border-accent hover:brightness-95",
  secondary: "bg-transparent text-navy border border-border hover:bg-navy/5",
} as const;

// Square corners (no rounded-*), condensed heading font — Industry's ".btn"/".btn-primary" pattern.
const baseClasses =
  "inline-flex items-center justify-center px-3 py-2 text-sm font-semibold font-heading tracking-wide transition disabled:opacity-45 w-fit";

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

  // Primary button gets the one solid, blueprint-marked object on the screen.
  const marks = variant === "primary" ? (
    <>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
    </>
  ) : null;

  if (href) {
    return (
      <Link href={href} className={`blueprint ${classes}`}>
        {marks}{children}
      </Link>
    );
  }

  return (
    <button className={`blueprint ${classes}`} {...rest}>
      {marks}{children}
    </button>
  );
}
