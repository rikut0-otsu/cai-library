import type { AppRouter } from "../../../server/routers";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

export type CaseStudy = inferRouterOutputs<AppRouter>["caseStudies"]["list"][number];
export type CaseStudyCreateInput =
  inferRouterInputs<AppRouter>["caseStudies"]["create"];
