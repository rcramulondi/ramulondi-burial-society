import { auth } from "@/lib/auth";
import Link from "next/link";
import Card from "@/components/ui/Card";

function Shot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" className="w-full h-auto block" />
      <figcaption className="text-xs text-neutral-500 px-3 py-2 border-t border-slate-200">{caption}</figcaption>
    </figure>
  );
}

function Topic({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-200 pt-6 mt-6 first:border-t-0 first:pt-0 first:mt-0">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="font-semibold text-navy">{title}</h3>
        {tag && (
          <span className="text-[11px] font-medium tracking-wide uppercase text-neutral-500 border border-slate-200 rounded px-1.5 py-0.5">
            {tag}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export default async function HelpPage() {
  const session = await auth();

  return (
    <div className="flex flex-col gap-10 max-w-3xl mx-auto">
      <div>
        <p className="text-xs font-semibold tracking-wide uppercase text-accent mb-1">App guide</p>
        <h1 className="text-2xl font-semibold text-navy">Getting acquainted with the app</h1>
        <p className="text-neutral-500 mt-2">
          This page walks through what you can do in the Ramulondi Burial Society app, with real
          screenshots alongside each step — whether you&apos;re a member checking your own account, or
          an admin running the society&apos;s day-to-day business.
        </p>
        <div className="mt-4">
          {session?.user ? (
            <Link href={session.user.role === "ADMIN" ? "/admin/dashboard" : "/dashboard"} className="text-sm text-accent hover:underline">
              &larr; Back to your dashboard
            </Link>
          ) : (
            <Link href="/login" className="text-sm text-accent hover:underline">
              &larr; Back to sign in
            </Link>
          )}
        </div>
      </div>

      <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm border-y border-slate-200 py-3">
        <a href="#starting" className="text-accent hover:underline">Signing in</a>
        <a href="#members" className="text-accent hover:underline">For members</a>
        <a href="#admins" className="text-accent hover:underline">For admins</a>
        <a href="#faq" className="text-accent hover:underline">Tips &amp; questions</a>
      </nav>

      <section id="starting" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-navy">Signing in</h2>
        <p className="text-sm text-neutral-700">
          Every member and admin signs in with an <strong>email address or cell number</strong> and a
          password. If you don&apos;t have login details yet, ask a committee member to send you an
          activation link. The first time you sign in, you&apos;ll be asked to set your own password.
        </p>
        <p className="text-sm text-neutral-700">
          After five wrong password attempts in a row, the account locks itself for 15 minutes as a
          safety measure — just wait and try again, or ask an admin to unlock it sooner.
        </p>
        <Shot src="/help/login.png" alt="The sign-in screen" caption="The sign-in screen — enter your email or cell number and password here." />
      </section>

      <section id="members" className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-navy">For members</h2>
        <p className="text-sm text-neutral-500 mb-2">
          Once you&apos;re signed in, everything here is about your own policy — your contributions,
          your beneficiaries, and any claims on your account.
        </p>

        <Topic title="Dashboard">
          <p className="text-sm text-neutral-700">
            Your starting page after signing in. It shows your membership status, what you&apos;ve
            contributed this year, and quick links to the rest of the app.
          </p>
          <Shot src="/help/member-dashboard.png" alt="Member dashboard" caption="Your dashboard: status, outstanding balance, beneficiaries, and claim status at a glance." />
        </Topic>

        <Topic title="Contributions">
          <p className="text-sm text-neutral-700">
            Your payment history by month and year. Pick a year to see that year&apos;s contributions,
            and download a <strong>proof of payment</strong> for any individual payment.
          </p>
          <Shot src="/help/member-contributions.png" alt="Contributions page" caption="Contributions page: pick a year, see the monthly breakdown, and download a receipt." />
        </Topic>

        <Topic title="Filing a claim">
          <p className="text-sm text-neutral-700">
            If a member or one of their beneficiaries passes away, a family member files the claim.
          </p>
          <ol className="list-decimal list-inside text-sm text-neutral-700 flex flex-col gap-1">
            <li>Go to <strong>Claims &rarr; File a new claim</strong>.</li>
            <li>Say who has passed away and where the burial will take place.</li>
            <li>Enter who&apos;s receiving the payout, with their contact and banking details.</li>
            <li>Attach a death certificate — this is required before the claim can be submitted.</li>
          </ol>
          <Shot src="/help/member-claim-new.png" alt="File a new claim form" caption="The claim form — search for who has passed away, then fill in the payout details." />
          <p className="text-sm text-neutral-700">
            The committee is notified by email as soon as the claim comes in. Track its status from
            the Claims page, and download the payout&apos;s proof of payment once it&apos;s processed.
          </p>
          <Shot src="/help/member-claims.png" alt="Claims page showing status" caption="The Claims page shows the status of every claim on your policy." />
        </Topic>
      </section>

      <section id="admins" className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-navy">For admins</h2>
        <p className="text-sm text-neutral-500 mb-2">
          Admins see everything members do, plus screens for running the society. Some actions are
          limited to specific committee roles — you&apos;ll only see the actions your role allows.
        </p>

        <Topic title="Members" tag="Directory">
          <p className="text-sm text-neutral-700">
            Search, add, and open any member&apos;s record. Every list in the admin area can be
            searched and is split into pages, so you&apos;re never scrolling through hundreds of rows.
          </p>
          <Shot src="/help/admin-members.png" alt="Admin members list, filtered by search" caption="The Members list — type a name or membership number into the search box to find someone." />
        </Topic>

        <Topic title="Claims" tag="Review & payout">
          <p className="text-sm text-neutral-700">
            Open a claim to <strong>approve or reject</strong> it. Once approved, record the payout
            date and confirm the claimant&apos;s email so their proof of payment sends automatically.
          </p>
          <Shot src="/help/admin-claim-review.png" alt="Admin claim review page" caption="A claim's detail page, with the deceased, claimant, and banking details, and the review actions." />
        </Topic>

        <Topic title="Unallocated funds" tag="Treasurer">
          <p className="text-sm text-neutral-700">
            Deposits that arrive without a clear member reference land here instead of being lost.
            Search for the right member and allocate the deposit — a single deposit can even be split
            across several members if it covers more than one person&apos;s contribution.
          </p>
          <Shot src="/help/admin-unallocated-funds.png" alt="Unallocated funds page" caption="Record a deposit, then search and allocate it to the correct member." />
        </Topic>

        <Topic title="Bank statements" tag="Treasurer">
          <p className="text-sm text-neutral-700">
            Import a CSV bank statement and the app reconciles it automatically: payments that
            reference a membership number are recorded, transfers and fees are set aside, and
            anything else is queued for review as a possible expense.
          </p>
          <Shot src="/help/admin-bank-statements.png" alt="Import a bank statement form" caption="Choose the account, pick the CSV file exported from the bank, and import." />
        </Topic>

        <Topic title="Manage users" tag="Super Admin">
          <p className="text-sm text-neutral-700">
            Grant or revoke admin access, unlock an account after too many failed sign-in attempts,
            and reactivate a lapsed member so they&apos;re eligible for access again.
          </p>
          <Shot src="/help/admin-users.png" alt="Manage users page" caption="Manage Users — search for anyone, and see their role and account status at a glance." />
        </Topic>

        <Topic title="Reports" tag="Statements & analytics">
          <p className="text-sm text-neutral-700">
            Generate a society-wide statement of contributions, an income vs. expenditure report, or
            the annual general report for any year — plus a dashboard of membership and financial charts.
          </p>
          <Shot src="/help/admin-reports.png" alt="Reports page" caption="Every report the society needs, generated on demand for any year." />
        </Topic>

        <p className="text-sm text-neutral-500">
          A few other screens round out the admin area: <strong>Expenses</strong> (record what the
          society spends, with a receipt), <strong>Committee</strong> (see and assign who holds each
          role), <strong>Meetings</strong> (schedule meetings and upload minutes), and{" "}
          <strong>Audit Log</strong> (a searchable record of every sensitive action, for accountability).
        </p>
      </section>

      <section id="faq" className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-navy mb-3">Tips &amp; questions</h2>

        <div className="border-t border-slate-200 py-3">
          <h3 className="text-sm font-semibold text-navy mb-1">I forgot my password.</h3>
          <p className="text-sm text-neutral-500">Ask an admin to send you a fresh activation link — this resets your sign-in.</p>
        </div>
        <div className="border-t border-slate-200 py-3">
          <h3 className="text-sm font-semibold text-navy mb-1">My account is locked.</h3>
          <p className="text-sm text-neutral-500">
            That clears itself automatically after 15 minutes. An admin can also unlock it sooner
            from Manage Users.
          </p>
        </div>
        <div className="border-t border-slate-200 py-3">
          <h3 className="text-sm font-semibold text-navy mb-1">Where do I get a proof of payment?</h3>
          <p className="text-sm text-neutral-500">
            From your Contributions page for a regular payment, or from the Claims page once a payout
            has been processed. Both are downloadable PDFs you can keep or print at any time.
          </p>
        </div>
        <div className="border-t border-slate-200 py-3">
          <h3 className="text-sm font-semibold text-navy mb-1">Why can&apos;t I see an option an admin mentioned?</h3>
          <p className="text-sm text-neutral-500">
            Some admin actions are limited to a specific committee role — for example, only the
            Treasurer records expenses and payouts. If something seems missing, it may belong to a
            different role.
          </p>
        </div>
      </section>

      <Card className="text-sm text-neutral-500 flex items-center justify-between flex-wrap gap-2">
        <span>Ramulondi Burial Society</span>
        <span>Still stuck? Ask any committee member for help.</span>
      </Card>
    </div>
  );
}
