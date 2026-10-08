"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LAUNCH_DATE } from "@daydan/core";
import { useToday } from "@/lib/use-today";
import buttons from "./button.module.css";

const launchDay = new Intl.DateTimeFormat("ar-SA-u-nu-arab-ca-gregory", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
}).format(new Date(`${LAUNCH_DATE}T00:00:00Z`));

/** After launch: go straight to today's page. Before launch: say when we start. */
export function HomeToday() {
  const today = useToday();
  const router = useRouter();
  const page = today?.scheduled?.page;

  useEffect(() => {
    if (page) router.replace(`/p/${page}/`);
  }, [page, router]);

  if (page) return <Link className={buttons.primary} href={`/p/${page}/`}>صفحة اليوم</Link>;
  return <p>نبدأ معاً يوم {launchDay} بإذن الله، بالصفحة الأولى.</p>;
}
