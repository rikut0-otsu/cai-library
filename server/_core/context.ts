import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  protocol?: string;
};

export type ResponseLike = {
  clearCookie?: (name: string, options: Record<string, unknown>) => void;
};

export type TrpcContext = {
  req: RequestLike;
  res: ResponseLike;
  user: User | null;
};

export async function createContext(opts: {
  req: RequestLike;
  res: ResponseLike;
}): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
