import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  appSettings,
  InsertCaseStudy,
  InsertAppSetting,
  InsertUserProfile,
  InsertUser,
  caseStudies,
  favorites,
  userProfiles,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

type D1DatabaseLike = Parameters<typeof drizzle>[0];

// Initialize once per worker isolate.
export function initDb(d1: D1DatabaseLike | null | undefined) {
  if (!_db && d1) {
    _db = drizzle(d1);
  }
  return _db;
}

// Lazily return the cached database instance.
export async function getDb() {
  if (!_db) {
    console.warn(
      "[Database] Database not initialized. Call initDb with the D1 binding."
    );
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = Date.now();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = Date.now();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user by id: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot list users: database not available");
    return [];
  }

  return db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt));
}

export async function updateUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update user role: database not available");
    return false;
  }

  await db
    .update(users)
    .set({ role })
    .where(eq(users.id, id));

  return true;
}

export async function reassignCaseStudiesOwner(
  fromUserId: number,
  toUserId: number
) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot reassign case studies: database not available");
    return false;
  }

  await db
    .update(caseStudies)
    .set({
      userId: toUserId,
      updatedAt: Date.now(),
    })
    .where(eq(caseStudies.userId, fromUserId));

  return true;
}

export async function deleteUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete user: database not available");
    return false;
  }

  await db.delete(users).where(eq(users.id, id));
  return true;
}
// ========================================
// Case Studies Queries
// ========================================

export async function getAllCaseStudies() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      caseStudy: caseStudies,
      authorName: users.name,
      authorRole: users.role,
      authorOpenId: users.openId,
    })
    .from(caseStudies)
    .leftJoin(users, eq(caseStudies.userId, users.id))
    .orderBy(caseStudies.createdAt);
  return result.map((item) => ({
    ...item.caseStudy,
    authorName: item.authorName,
    authorRole: item.authorRole,
    authorIsOwner: item.authorOpenId === ENV.ownerOpenId,
  }));
}

export async function getCaseStudyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select({
      caseStudy: caseStudies,
      authorName: users.name,
      authorRole: users.role,
      authorOpenId: users.openId,
    })
    .from(caseStudies)
    .leftJoin(users, eq(caseStudies.userId, users.id))
    .where(eq(caseStudies.id, id))
    .limit(1);
  if (result.length === 0) return undefined;
  return {
    ...result[0].caseStudy,
    authorName: result[0].authorName,
    authorRole: result[0].authorRole,
    authorIsOwner: result[0].authorOpenId === ENV.ownerOpenId,
  };
}

export async function createCaseStudy(data: InsertCaseStudy) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(caseStudies).values(data);
  // Get the last inserted record by userId and timestamp
  const [inserted] = await db
    .select({ id: caseStudies.id })
    .from(caseStudies)
    .where(eq(caseStudies.userId, data.userId))
    .orderBy(desc(caseStudies.createdAt))
    .limit(1);
  return { insertId: inserted?.id || 0 };
}

export async function updateCaseStudy(
  id: number,
  data: Partial<Omit<InsertCaseStudy, "userId">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateSet: Record<string, unknown> = {
    updatedAt: Date.now(),
  };

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updateSet[key] = value;
    }
  }

  await db.update(caseStudies).set(updateSet).where(eq(caseStudies.id, id));
  return true;
}

export async function getUserCaseStudies(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      caseStudy: caseStudies,
      authorName: users.name,
      authorRole: users.role,
      authorOpenId: users.openId,
    })
    .from(caseStudies)
    .leftJoin(users, eq(caseStudies.userId, users.id))
    .where(eq(caseStudies.userId, userId))
    .orderBy(caseStudies.createdAt);
  return result.map((item) => ({
    ...item.caseStudy,
    authorName: item.authorName,
    authorRole: item.authorRole,
    authorIsOwner: item.authorOpenId === ENV.ownerOpenId,
  }));
}

// ========================================
// Favorites Queries
// ========================================

export async function getUserFavorites(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      id: favorites.id,
      caseStudyId: favorites.caseStudyId,
      createdAt: favorites.createdAt,
      caseStudy: caseStudies,
      authorName: users.name,
      authorRole: users.role,
      authorOpenId: users.openId,
    })
    .from(favorites)
    .innerJoin(caseStudies, eq(favorites.caseStudyId, caseStudies.id))
    .leftJoin(users, eq(caseStudies.userId, users.id))
    .where(eq(favorites.userId, userId))
    .orderBy(favorites.createdAt);
  
  return result;
}

export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.warn(
      "[Database] Failed to read user profile. Migration may be pending.",
      error
    );
    return undefined;
  }
}

export async function updateUserProfile(
  userId: number,
  data: {
    name: string;
    departmentRole: string | null;
  }
) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update user profile: database not available");
    return false;
  }

  await db
    .update(users)
    .set({
      name: data.name,
      updatedAt: Date.now(),
    })
    .where(eq(users.id, userId));

  try {
    const values: InsertUserProfile = {
      userId,
      departmentRole: data.departmentRole,
    };
    await db.insert(userProfiles).values(values).onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        departmentRole: data.departmentRole,
        updatedAt: Date.now(),
      },
    });
  } catch (error) {
    console.warn(
      "[Database] Failed to persist departmentRole. Migration may be pending.",
      error
    );
  }

  return true;
}

export async function isFavorite(userId: number, caseStudyId: number) {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .select()
    .from(favorites)
    .where(
      and(eq(favorites.userId, userId), eq(favorites.caseStudyId, caseStudyId))
    )
    .limit(1);
  
  return result.length > 0;
}

export async function addFavorite(userId: number, caseStudyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    await db.insert(favorites).values({ userId, caseStudyId });
    return true;
  } catch (error) {
    // 既にお気に入りに追加済みの場合はエラーを無視
    return false;
  }
}

export async function removeFavorite(userId: number, caseStudyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(favorites)
    .where(
      and(eq(favorites.userId, userId), eq(favorites.caseStudyId, caseStudyId))
    );
  
  return true;
}

export async function deleteCaseStudy(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(favorites).where(eq(favorites.caseStudyId, id));
  await db.delete(caseStudies).where(eq(caseStudies.id, id));
  return true;
}

export async function getAppSetting(key: string) {
  const db = await getDb();
  if (!db) return undefined;

  // Guard against missing migrations in existing environments.
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key text primary key,
      value text,
      updated_at integer not null default (unixepoch() * 1000)
    )
  `);

  const result = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function setAppSetting(key: string, value: string | null) {
  const db = await getDb();
  if (!db) return false;

  // Guard against missing migrations in existing environments.
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key text primary key,
      value text,
      updated_at integer not null default (unixepoch() * 1000)
    )
  `);

  const values: InsertAppSetting = {
    key,
    value,
  };

  await db.insert(appSettings).values(values).onConflictDoUpdate({
    target: appSettings.key,
    set: {
      value,
      updatedAt: Date.now(),
    },
  });

  return true;
}

