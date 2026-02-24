import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const nowMs = sql`(unixepoch() * 1000)`;

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = sqliteTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: integer("createdAt").notNull().default(nowMs),
  updatedAt: integer("updatedAt").notNull().default(nowMs),
  lastSignedIn: integer("lastSignedIn").notNull().default(nowMs),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Optional profile fields managed by users.
 * Keep this separate from auth-backed user columns.
 */
export const userProfiles = sqliteTable("user_profiles", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  departmentRole: text("department_role"),
  createdAt: integer("created_at").notNull().default(nowMs),
  updatedAt: integer("updated_at").notNull().default(nowMs),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

/**
 * Case studies table.
 */
export const caseStudies = sqliteTable("case_studies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Author user id */
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Case study title */
  title: text("title").notNull(),
  /** Short description */
  description: text("description").notNull(),
  /** Thumbnail URL */
  thumbnailUrl: text("thumbnail_url"),
  /** Thumbnail storage key */
  thumbnailKey: text("thumbnail_key"),
  /** Category */
  category: text("category", {
    enum: ["prompt", "automation", "tools", "business", "activation"],
  }).notNull(),
  /** Tools used (JSON array) */
  tools: text("tools").notNull(),
  /** Challenge */
  challenge: text("challenge").notNull(),
  /** Solution */
  solution: text("solution").notNull(),
  /** Steps (JSON array) */
  steps: text("steps").notNull(),
  /** Impact */
  impact: text("impact"),
  /** Tags (JSON array) */
  tags: text("tags").notNull(),
  /** Recommended flag */
  isRecommended: integer("is_recommended").notNull().default(0),
  createdAt: integer("created_at").notNull().default(nowMs),
  updatedAt: integer("updated_at").notNull().default(nowMs),
});

export type CaseStudy = typeof caseStudies.$inferSelect;
export type InsertCaseStudy = typeof caseStudies.$inferInsert;

/**
 * Favorites table.
 */
export const favorites = sqliteTable(
  "favorites",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    caseStudyId: integer("case_study_id")
      .notNull()
      .references(() => caseStudies.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  table => ({
    uniqueUserCase: uniqueIndex("favorites_user_case_unique").on(
      table.userId,
      table.caseStudyId
    ),
  })
);

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

/**
 * Key-value settings table for app-wide configuration.
 */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: integer("updated_at").notNull().default(nowMs),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;
