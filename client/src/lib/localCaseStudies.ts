export type CaseStudyCategory =
  | "prompt"
  | "automation"
  | "tools"
  | "business"
  | "activation";

export type CaseStudy = {
  id: number;
  title: string;
  description: string;
  category: CaseStudyCategory;
  tools: string[];
  challenge: string;
  solution: string;
  steps: string[];
  impact: string | null;
  thumbnailUrl: string | null;
  tags: string[];
  isRecommended: 0 | 1;
  isFavorite: boolean;
  createdAt: number;
};

export type CaseStudyInput = {
  title: string;
  description: string;
  category: CaseStudyCategory;
  tools: string[];
  challenge: string;
  solution: string;
  steps: string[];
  impact?: string;
  thumbnailUrl?: string;
  tags?: string[];
};

const STORAGE_KEY = "ai-library.case-studies";

const canUseStorage = () =>
  typeof window !== "undefined" && Boolean(window.localStorage);

const normalizeCaseStudy = (input: unknown): CaseStudy | null => {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  const id = typeof raw.id === "number" ? raw.id : Date.now();
  const createdAt =
    typeof raw.createdAt === "number" ? raw.createdAt : Date.now();
  const category = (raw.category ?? "automation") as CaseStudyCategory;

  return {
    id,
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    category,
    tools: Array.isArray(raw.tools) ? raw.tools.map(String) : [],
    challenge: String(raw.challenge ?? ""),
    solution: String(raw.solution ?? ""),
    steps: Array.isArray(raw.steps) ? raw.steps.map(String) : [],
    impact: raw.impact ? String(raw.impact) : null,
    thumbnailUrl: raw.thumbnailUrl ? String(raw.thumbnailUrl) : null,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    isRecommended: raw.isRecommended === 1 ? 1 : 0,
    isFavorite: Boolean(raw.isFavorite),
    createdAt,
  };
};

const readStorage = (): CaseStudy[] => {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeCaseStudy)
      .filter((item): item is CaseStudy => Boolean(item));
  } catch {
    return [];
  }
};

const writeStorage = (cases: CaseStudy[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
};

const nextId = (cases: CaseStudy[]) => {
  const maxId = cases.reduce((max, item) => Math.max(max, item.id), 0);
  return maxId + 1;
};

export const listCaseStudies = () =>
  readStorage().sort((a, b) => a.createdAt - b.createdAt);

export const getCaseStudyById = (id: number) =>
  readStorage().find((item) => item.id === id) ?? null;

export const generateTags = (input: {
  category: CaseStudyCategory;
  tools: string[];
  title?: string;
  description?: string;
}) => {
  const base = [input.category, ...input.tools].filter(Boolean);
  const unique = Array.from(new Set(base.map((tag) => tag.trim()))).filter(
    (tag) => tag.length > 0
  );
  return unique.slice(0, 5);
};

export const createCaseStudy = (input: CaseStudyInput) => {
  const cases = readStorage();
  const newCase: CaseStudy = {
    id: nextId(cases),
    title: input.title,
    description: input.description,
    category: input.category,
    tools: input.tools,
    challenge: input.challenge,
    solution: input.solution,
    steps: input.steps,
    impact: input.impact ?? null,
    thumbnailUrl: input.thumbnailUrl ?? null,
    tags: input.tags ?? generateTags(input),
    isRecommended: 0,
    isFavorite: false,
    createdAt: Date.now(),
  };

  cases.push(newCase);
  writeStorage(cases);
  return newCase;
};

export const toggleFavorite = (id: number) => {
  const cases = readStorage();
  const index = cases.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const updated = {
    ...cases[index],
    isFavorite: !cases[index].isFavorite,
  };
  cases[index] = updated;
  writeStorage(cases);
  return updated;
};

export const deleteCaseStudy = (id: number) => {
  const cases = readStorage();
  const nextCases = cases.filter((item) => item.id !== id);
  if (nextCases.length === cases.length) return false;
  writeStorage(nextCases);
  return true;
};
