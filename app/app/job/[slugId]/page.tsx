import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Job } from "@/lib/supabase";
import { parseJobIdFromSlugId } from "@/lib/job-url";
import { sanitizeJobPostingHtml } from "@/lib/job-content";
import { withManekiRef } from "@/lib/apply-url";
import { timeAgo, SENIORITY_LABELS } from "@/lib/networks";
import { formatSalary } from "@/lib/salary";
import { cleanLocationForDisplay } from "@/lib/location-display";
import CompanyLogo from "@/components/CompanyLogo";
import SaveJobButton from "@/components/SaveJobButton";
import TrackedLink from "@/components/TrackedLink";

/**
 * Job detail dell'app: schermata mobile-first — essenziali sopra, descrizione
 * sotto, APPLY sticky sopra la tab bar. Nessun chrome sito. La rotta canonica
 * SEO resta /jobs/[slugId]; questa è noindex (layout /app).
 */

export const revalidate = 3600;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function getJob(id: number): Promise<Job | null> {
  const { data } = await getSupabase().from("jobs").select("*").eq("id", id).maybeSingle();
  return (data as Job) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slugId: string }>;
}): Promise<Metadata> {
  const { slugId } = await params;
  const id = parseJobIdFromSlugId(slugId);
  if (!id) return { title: "Job" };
  const job = await getJob(id);
  return { title: job ? `${job.title} at ${job.company}` : "Job" };
}

export default async function AppJobPage({
  params,
}: {
  params: Promise<{ slugId: string }>;
}) {
  const { slugId } = await params;
  const id = parseJobIdFromSlugId(slugId);
  if (!id) notFound();
  const job = await getJob(id);
  if (!job) notFound();

  const salary = formatSalary(job);
  const location = job.remote
    ? "Remote"
    : job.location
      ? cleanLocationForDisplay(job.location)
      : "Location not specified";
  const level = job.seniority ? SENIORITY_LABELS[job.seniority] : null;
  const applyUrl = withManekiRef(job.external_url || job.job_url);

  return (
    <main className="max-w-[560px] mx-auto px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-24">
      {/* Top: back */}
      <div className="flex items-center justify-between mb-5">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wider text-ink-dim hover:text-ink"
        >
          ← FEED
        </Link>
        <span className="font-mono text-[10px] font-bold tracking-wider text-ink-dim">
          {timeAgo(job.posted_at)?.toUpperCase()}
        </span>
      </div>

      {/* Company + title */}
      <div className="flex items-center gap-3 mb-4">
        <CompanyLogo src={job.logo_url} alt={job.company} size={48} />
        <div className="min-w-0">
          <div className="font-sans text-[15px] font-bold text-ink">{job.company}</div>
          <div className="font-mono text-[10px] tracking-wider text-ink-dim">
            {job.remote ? "REMOTE-FRIENDLY" : "ON SITE / HYBRID"}
          </div>
        </div>
      </div>
      <h1 className="font-sans text-[26px] font-black tracking-tight leading-tight mb-4">
        {job.title}
      </h1>

      {/* Fact chips */}
      <div className="flex gap-2 flex-wrap mb-6">
        {salary && (
          <span className="border border-line bg-card rounded-sharp px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider text-good">
            {salary}
          </span>
        )}
        <span className="border border-line bg-card rounded-sharp px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider text-ink">
          {location.toUpperCase()}
        </span>
        {level && (
          <span className="border border-line bg-card rounded-sharp px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider text-ink">
            {level.toUpperCase()}
          </span>
        )}
      </div>

      {!job.active && (
        <div className="border-[1.5px] border-accent bg-card rounded-sharp px-4 py-3.5 mb-6 font-sans text-[13.5px] text-ink">
          ⚠ This role is no longer active — the company closed it. Check your feed for similar open ones.
        </div>
      )}

      {/* Description */}
      {job.description ? (
        <div
          className="font-sans text-[15px] leading-relaxed text-ink-dim
            [&_p]:mb-3 [&_p:last-child]:mb-0
            [&_h1]:text-ink [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-2
            [&_h2]:text-ink [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2
            [&_h3]:text-ink [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-1
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul>li]:mb-1
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol>li]:mb-1
            [&_strong]:text-ink"
          dangerouslySetInnerHTML={{ __html: sanitizeJobPostingHtml(job.description) }}
        />
      ) : (
        <p className="font-sans text-[14px] text-ink-dim">
          Full description, requirements and benefits live on the original posting — tap APPLY to read
          everything and submit directly to {job.company}.
        </p>
      )}

      {/* Sticky apply, sopra la tab bar */}
      {job.active && (
        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 border-t border-line bg-bg px-4 py-3 flex items-center gap-3">
          <div className="max-w-[560px] mx-auto flex items-center gap-3 w-full">
            <SaveJobButton jobId={job.id} size="lg" className="shrink-0 border border-line bg-card" />
            <TrackedLink
              event="apply_click"
              eventProps={{ company: job.company, role: job.role_category ?? "unknown", surface: "app_native", remote: !!job.remote, has_salary: job.salary_min != null || job.salary_max != null }}
              href={applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center h-12 bg-accent text-accent-fg font-mono text-[13px] font-bold tracking-wider rounded-sharp hover:opacity-90 transition-opacity"
            >
              APPLY →
            </TrackedLink>
          </div>
        </div>
      )}
    </main>
  );
}
