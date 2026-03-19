import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, boards, InsertBoard } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db) {
    const dbUrl = process.env.DATABASE_URL || ENV.databaseUrl;
    if (dbUrl) {
      try {
        console.log("[Database] Connecting to database...");
        _db = drizzle(dbUrl);
        console.log("[Database] Connected successfully");
      } catch (error) {
        console.warn("[Database] Failed to connect:", error);
        _db = null;
      }
    } else {
      console.warn("[Database] No DATABASE_URL or ENV.databaseUrl provided");
    }
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
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
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

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Board queries
export async function getUserBoards(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get boards: database not available");
    return [];
  }

  try {
    return await db.select().from(boards).where(eq(boards.userId, userId));
  } catch (error) {
    console.error("[Database] Failed to get boards:", error);
    return [];
  }
}

export async function createBoard(data: InsertBoard) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    await db.insert(boards).values(data);
    return true;
  } catch (error) {
    console.error("[Database] Failed to create board:", error);
    throw error;
  }
}

export async function updateBoard(id: number, data: Partial<InsertBoard>) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    console.log("[Database] Updating board with id:", id, "data:", data);
    const result = await db.update(boards).set(data).where(eq(boards.id, id));
    console.log("[Database] Update result:", result);
    return result;
  } catch (error) {
    console.error("[Database] Failed to update board:", error);
    throw error;
  }
}

export async function deleteBoard(id: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    console.log("[Database] Deleting board with id:", id);
    const result = await db.delete(boards).where(eq(boards.id, id));
    console.log("[Database] Delete result:", result);
    return result;
  } catch (error) {
    console.error("[Database] Failed to delete board:", error);
    throw error;
  }
}
