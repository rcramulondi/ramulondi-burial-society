import Link from "next/link";

/**
 * Prev/Next pager for query-string-driven list pages. `params` should be
 * every OTHER filter currently applied (search, status, year, etc.) so
 * paging forward/back doesn't drop them — the page param itself is set
 * separately per link and must not be included in `params`. `pageParam`
 * defaults to "page"; override it when a page hosts more than one
 * independently-paginated list (e.g. "importPage"/"txPage").
 */
export default function Pagination({
  page,
  totalPages,
  basePath,
  params = {},
  pageParam = "page",
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params?: Record<string, string | undefined>;
  pageParam?: string;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) usp.set(k, v);
    }
    usp.set(pageParam, String(p));
    return `${basePath}?${usp.toString()}`;
  };

  return (
    <nav className="flex gap-2 text-sm items-center">
      {page > 1 && (
        <Link href={href(page - 1)} className="text-accent hover:underline">
          &larr; Previous
        </Link>
      )}
      <span className="text-neutral-500">
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <Link href={href(page + 1)} className="text-accent hover:underline">
          Next &rarr;
        </Link>
      )}
    </nav>
  );
}
