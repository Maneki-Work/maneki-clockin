"use client";

import Link from "next/link";
import type { Job } from "@/lib/supabase";
import { timeAgo, SENIORITY_LABELS } from "@/lib/networks";
import { formatSalary } from "@/lib/salary";
import { jobSlugId } from "@/lib/job-url";
import { capitalizeLocationToken } from "@/lib/location-display";
import CompanyLogo from "@/components/CompanyLogo";
import SaveJobButton from "@/components/SaveJobButton";

/**
 * Card job dell'app: pensata per il pollice — company sopra, titolo grande,
 * riga fatti (salary · dove · quando) sotto. Naviga a /app/job/[slugId].
 */
export default function AppJobCard({ job }: { job: Job }) {
  const salary = formatSalary(job);
  const location = job.remote
    ? "Remote"
    : job.city
      ? job.city
      : job.location
        ? capitalizeLocationToken(job.location.split(",")[0])
        : null;
  const level = job.seniority ? SENIORITY_LABELS[job.seniority] : null;

  return (
    <Link
      href={`/app/job/${jobSlugId(job)}`}
      className="block bg-card border border-line rounded-sharp px-4 py-4 active:bg-line-2 transition-colors"
    >
      <div className="flex items-center gap-3 mb-2.5">
        <CompanyLogo src={job.logo_url} alt={job.company} size={34} />
        <div className="min-w-0 flex-1">
          <div className="font-sans text-[13px] font-bold text-ink truncate">{job.company}</div>
          <div className="font-mono text-[10px] tracking-wider text-ink-dim">
            {timeAgo(job.posted_at)?.toUpperCase()}
          </div>
        </div>
        <SaveJobButton jobId={job.id} />
      </div>
      <div className="font-sans text-[16.5px] font-extrabold tracking-tight leading-snug text-ink mb-2">
        {job.title}
      </div>
      <div className="flex items-center gap-2 flex-wrap font-mono text-[10.5px] font-bold tracking-wider">
        {salary && <span className="text-good">{salary}</span>}
        {salary && (location || level) && <span className="text-ink-dim opacity-50">·</span>}
        {location && <span className="text-ink-dim">{location.toUpperCase()}</span>}
        {location && level && <span className="text-ink-dim opacity-50">·</span>}
        {level && <span className="text-ink-dim">{level.toUpperCase()}</span>}
      </div>
    </Link>
  );
}
