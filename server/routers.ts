import { COOKIE_NAME, NOT_ADMIN_ERR_MSG } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";

const INVITE_CODE_SETTING_KEY = "auth.inviteCode";

const decodeBase64 = (input: string) => {
  if (typeof atob === "function") {
    const binary = atob(input);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(input, "base64"));
  }

  throw new Error("Base64 decoding is not supported in this environment.");
};

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  profile: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found.",
        });
      }

      const profile = await db.getUserProfile(ctx.user.id);
      const cases = await db.getUserCaseStudies(ctx.user.id);

      return {
        user: {
          id: user.id,
          name: user.name ?? "",
          email: user.email,
          role: user.role,
          loginMethod: user.loginMethod,
          departmentRole: profile?.departmentRole ?? "",
        },
        caseStudies: cases.map((c) => ({
          ...c,
          tools: JSON.parse(c.tools),
          steps: JSON.parse(c.steps),
          tags: JSON.parse(c.tags),
          isFavorite: false,
          authorName: c.authorName ?? "不明",
        })),
      };
    }),

    update: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(80),
          departmentRole: z.string().trim().max(120).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, {
          name: input.name,
          departmentRole: input.departmentRole?.trim() || null,
        });

        return { success: true } as const;
      }),
    getByUserId: publicProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const user = await db.getUserById(input.userId);
        if (!user) return null;

        const profile = await db.getUserProfile(input.userId);
        const cases = await db.getUserCaseStudies(input.userId);

        return {
          user: {
            id: user.id,
            name: user.name ?? "不明",
            role: user.role,
            departmentRole: profile?.departmentRole ?? "",
          },
          caseStudies: cases.map((c) => ({
            ...c,
            tools: JSON.parse(c.tools),
            steps: JSON.parse(c.steps),
            tags: JSON.parse(c.tags),
            isFavorite: false,
            authorName: c.authorName ?? "不明",
            authorRole: c.authorRole ?? "user",
            authorIsOwner: Boolean(c.authorIsOwner),
          })),
        };
      }),
  }),

  admin: router({
    settings: router({
      getInviteCode: adminProcedure.query(async () => {
        const setting = await db.getAppSetting(INVITE_CODE_SETTING_KEY);
        return {
          inviteCode: setting?.value ?? "",
        };
      }),
      setInviteCode: adminProcedure
        .input(
          z.object({
            inviteCode: z.string().trim().max(128),
          })
        )
        .mutation(async ({ input }) => {
          await db.setAppSetting(
            INVITE_CODE_SETTING_KEY,
            input.inviteCode.trim() || null
          );
          return { success: true } as const;
        }),
    }),
    users: router({
      list: adminProcedure.query(async () => {
        const allUsers = await db.getAllUsers();
        return allUsers.map(item => ({
          ...item,
          isOwner: item.openId === ENV.ownerOpenId,
        }));
      }),

      updateRole: adminProcedure
        .input(
          z.object({
            userId: z.number().int().positive(),
            role: z.enum(["user", "admin"]),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const targetUser = await db.getUserById(input.userId);
          if (!targetUser) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "User not found.",
            });
          }

          if (targetUser.openId === ENV.ownerOpenId && input.role !== "admin") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Owner account role cannot be changed.",
            });
          }

          if (targetUser.id === ctx.user.id && input.role !== "admin") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "You cannot remove your own admin role.",
            });
          }

          await db.updateUserRole(input.userId, input.role);
          return { success: true } as const;
        }),

      delete: adminProcedure
        .input(
          z.object({
            userId: z.number().int().positive(),
            deleteCaseStudies: z.boolean(),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const targetUser = await db.getUserById(input.userId);
          if (!targetUser) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "User not found.",
            });
          }

          if (targetUser.openId === ENV.ownerOpenId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Owner account cannot be deleted.",
            });
          }

          if (targetUser.id === ctx.user.id) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "You cannot delete your own account.",
            });
          }

          if (!input.deleteCaseStudies) {
            await db.reassignCaseStudiesOwner(targetUser.id, ctx.user.id);
          }

          await db.deleteUserById(targetUser.id);
          return { success: true } as const;
        }),
    }),
  }),
  caseStudies: router({
    // 全事例一覧取得(公開)
    list: publicProcedure.query(async ({ ctx }) => {
      const cases = await db.getAllCaseStudies();
      
      // ログイン済みの場合はお気に入り情報も付与
      if (ctx.user) {
        const favorites = await db.getUserFavorites(ctx.user.id);
        const favoriteIds = new Set(favorites.map(f => f.caseStudyId));
        
        return cases.map(c => ({
          ...c,
          tools: JSON.parse(c.tools),
          steps: JSON.parse(c.steps),
          tags: JSON.parse(c.tags),
          isFavorite: favoriteIds.has(c.id),
          authorName: c.authorName ?? "不明",
          authorRole: c.authorRole ?? "user",
          authorIsOwner: Boolean(c.authorIsOwner),
        }));
      }
      
      return cases.map(c => ({
        ...c,
        tools: JSON.parse(c.tools),
        steps: JSON.parse(c.steps),
        tags: JSON.parse(c.tags),
        isFavorite: false,
        authorName: c.authorName ?? "不明",
        authorRole: c.authorRole ?? "user",
        authorIsOwner: Boolean(c.authorIsOwner),
      }));
    }),

    // 事例詳細取得
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const caseStudy = await db.getCaseStudyById(input.id);
        if (!caseStudy) return null;
        
        const isFav = ctx.user ? await db.isFavorite(ctx.user.id, input.id) : false;
        
        return {
          ...caseStudy,
          tools: JSON.parse(caseStudy.tools),
          steps: JSON.parse(caseStudy.steps),
          tags: JSON.parse(caseStudy.tags),
          isFavorite: isFav,
          authorName: caseStudy.authorName ?? "不明",
          authorRole: caseStudy.authorRole ?? "user",
          authorIsOwner: Boolean(caseStudy.authorIsOwner),
        };
      }),

    // 新規事例作成(認証必須)
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1),
          description: z.string().min(1),
          category: z.enum([
            "prompt",
            "automation",
            "tools",
            "business",
            "activation",
          ]),
          tools: z.array(z.string()),
          challenge: z.string().min(1),
          solution: z.string().min(1),
          steps: z.array(z.string()),
          impact: z.string().optional(),
          thumbnailUrl: z.string().optional(),
          thumbnailKey: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.loginMethod !== "google") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Google login required to post.",
          });
        }
        // AIでタグを自動生成
        const tags = await generateTags({
          title: input.title,
          description: input.description,
          tools: input.tools,
          category: input.category,
        });

        const result = await db.createCaseStudy({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          category: input.category,
          tools: JSON.stringify(input.tools),
          challenge: input.challenge,
          solution: input.solution,
          steps: JSON.stringify(input.steps),
          impact: input.impact || null,
          thumbnailUrl: input.thumbnailUrl || null,
          thumbnailKey: input.thumbnailKey || null,
          tags: JSON.stringify(tags),
          isRecommended: 0,
        });

        return { success: true, id: Number(result.insertId) };
      }),

    // 事例更新(認証必須)
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1),
          description: z.string().min(1),
          category: z.enum([
            "prompt",
            "automation",
            "tools",
            "business",
            "activation",
          ]),
          tools: z.array(z.string()),
          challenge: z.string().min(1),
          solution: z.string().min(1),
          steps: z.array(z.string()),
          impact: z.string().optional(),
          thumbnailUrl: z.string().optional(),
          thumbnailKey: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.loginMethod !== "google") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Google login required to post.",
          });
        }

        const caseStudy = await db.getCaseStudyById(input.id);
        if (!caseStudy) return { success: false };

        if (caseStudy.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
        }

        const tags = await generateTags({
          title: input.title,
          description: input.description,
          tools: input.tools,
          category: input.category,
        });

        await db.updateCaseStudy(input.id, {
          title: input.title,
          description: input.description,
          category: input.category,
          tools: JSON.stringify(input.tools),
          challenge: input.challenge,
          solution: input.solution,
          steps: JSON.stringify(input.steps),
          impact: input.impact || null,
          thumbnailUrl: input.thumbnailUrl || null,
          thumbnailKey: input.thumbnailKey || null,
          tags: JSON.stringify(tags),
        });

        return { success: true };
      }),

    // お気に入りトグル
    toggleFavorite: protectedProcedure
      .input(z.object({ caseStudyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const isFav = await db.isFavorite(ctx.user.id, input.caseStudyId);
        
        if (isFav) {
          await db.removeFavorite(ctx.user.id, input.caseStudyId);
          return { isFavorite: false };
        } else {
          await db.addFavorite(ctx.user.id, input.caseStudyId);
          return { isFavorite: true };
        }
      }),

    // お気に入り一覧取得
    getFavorites: protectedProcedure.query(async ({ ctx }) => {
      const favorites = await db.getUserFavorites(ctx.user.id);
      return favorites.map(f => ({
        ...f.caseStudy,
        tools: JSON.parse(f.caseStudy.tools),
        steps: JSON.parse(f.caseStudy.steps),
        tags: JSON.parse(f.caseStudy.tags),
        isFavorite: true,
        authorName: f.authorName ?? "不明",
        authorRole: f.authorRole ?? "user",
        authorIsOwner: Boolean(f.authorIsOwner),
      }));
    }),

    // delete case study
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const caseStudy = await db.getCaseStudyById(input.id);
        if (!caseStudy) return { success: false };

        if (caseStudy.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
        }

        await db.deleteCaseStudy(input.id);
        return { success: true };
      }),

    // 画像アップロード
    uploadImage: protectedProcedure
      .input(
        z.object({
          filename: z.string(),
          contentType: z.string(),
          base64Data: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { storagePut } = await import("./storage");
        
        // Base64データをBufferに変換
        const buffer = decodeBase64(input.base64Data);
        
        // ランダムなサフィックスを追加してユニークなファイル名を生成
        const randomSuffix = Math.random().toString(36).substring(2, 15);
        const fileKey = `case-studies/${ctx.user.id}/${input.filename}-${randomSuffix}`;
        
        const result = await storagePut(fileKey, buffer, input.contentType);
        
        return {
          url: result.url,
          key: result.key,
        };
      }),
  }),
});

/**
 * AIを使ってタグを自動生成
 */
async function generateTags(data: {
  title: string;
  description: string;
  tools: string[];
  category: string;
}): Promise<string[]> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates relevant tags for AI use cases. Return only a JSON array of 3-5 short tags in Japanese.",
        },
        {
          role: "user",
          content: `Generate tags for this AI use case:\nTitle: ${data.title}\nDescription: ${data.description}\nTools: ${data.tools.join(", ")}\nCategory: ${data.category}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "tags",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Array of 3-5 relevant tags",
              },
            },
            required: ["tags"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === "string") {
      const parsed = JSON.parse(content);
      return parsed.tags || [];
    }
  } catch (error) {
    console.error("Failed to generate tags:", error);
  }

  // フォールバック: 基本的なタグを返す
  return [data.category, ...data.tools.slice(0, 2)];
}

export type AppRouter = typeof appRouter;


