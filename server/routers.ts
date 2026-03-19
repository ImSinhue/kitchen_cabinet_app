import { z } from "zod";
import { eq } from "drizzle-orm";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  boards: router({
    list: publicProcedure.query(() =>
      db.getUserBoards(1)
    ),

    create: publicProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        materialType: z.string().min(1).max(50),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        thickness: z.number().int().positive(),
        price: z.string().min(1).max(20),
        quantity: z.number().int().nonnegative(),
      }))
      .mutation(({ input }) =>
        db.createBoard({
          userId: 1,
          ...input,
        })
      ),

    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) =>
        db.deleteBoard(input.id)
      ),

    update: publicProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        materialType: z.string().min(1).max(50).optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        thickness: z.number().int().positive().optional(),
        price: z.string().min(1).max(20).optional(),
        quantity: z.number().int().nonnegative().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateBoard(id, data);
      }),
  }),
});

export type AppRouter = typeof appRouter;
