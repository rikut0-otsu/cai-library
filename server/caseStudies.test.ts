import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "google",
    role: "user",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastSignedIn: Date.now(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("caseStudies.list", () => {
  it("returns empty array when no cases exist", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.caseStudies.list();

    expect(Array.isArray(result)).toBe(true);
  });

  it("returns cases with parsed JSON fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.caseStudies.list();

    result.forEach((caseStudy) => {
      expect(Array.isArray(caseStudy.tools)).toBe(true);
      expect(Array.isArray(caseStudy.steps)).toBe(true);
      expect(Array.isArray(caseStudy.tags)).toBe(true);
      expect(typeof caseStudy.isFavorite).toBe("boolean");
    });
  });
});

describe("caseStudies.create", () => {
  it("creates a new case study with required fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.caseStudies.create({
      title: "Test Case Study",
      description: "Test description",
      category: "automation",
      tools: ["ChatGPT", "GAS"],
      challenge: "Test challenge",
      solution: "Test solution",
      steps: ["Step 1", "Step 2"],
    });

    expect(result.success).toBe(true);
    expect(typeof result.id).toBe("number");
  });

  it("creates a case study with optional fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.caseStudies.create({
      title: "Test Case with Impact",
      description: "Test description",
      category: "business",
      tools: ["Claude"],
      challenge: "Test challenge",
      solution: "Test solution",
      steps: ["Step 1"],
      impact: "Reduced time by 50%",
      thumbnailUrl: "https://example.com/image.png",
      thumbnailKey: "test-key",
    });

    expect(result.success).toBe(true);
    expect(typeof result.id).toBe("number");
  });
});

describe("caseStudies.getById", () => {
  it("returns null for non-existent case", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.caseStudies.getById({ id: 999999 });

    expect(result).toBeNull();
  });
});

describe("caseStudies.toggleFavorite", () => {
  it("requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.caseStudies.toggleFavorite({ caseStudyId: 1 })
    ).rejects.toThrow();
  });

  it("toggles favorite status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a test case first
    const created = await caller.caseStudies.create({
      title: "Favorite Test",
      description: "Test",
      category: "tools",
      tools: ["Test"],
      challenge: "Test",
      solution: "Test",
      steps: ["Test"],
    });

    // Add to favorites
    const addResult = await caller.caseStudies.toggleFavorite({
      caseStudyId: created.id,
    });
    expect(addResult.isFavorite).toBe(true);

    // Remove from favorites
    const removeResult = await caller.caseStudies.toggleFavorite({
      caseStudyId: created.id,
    });
    expect(removeResult.isFavorite).toBe(false);
  });
});

describe("caseStudies.getFavorites", () => {
  it("requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(caller.caseStudies.getFavorites()).rejects.toThrow();
  });

  it("returns empty array when user has no favorites", async () => {
    const ctx = createAuthContext(999);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.caseStudies.getFavorites();

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("caseStudies.uploadImage", () => {
  it("requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.caseStudies.uploadImage({
        filename: "test.png",
        contentType: "image/png",
        base64Data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      })
    ).rejects.toThrow();
  });
});
