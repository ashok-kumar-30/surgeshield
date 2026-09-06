// src/types/next-auth.d.ts
//
// Module augmentation extending the default NextAuth Session and JWT types
// with our custom fields: user.id and user.role.

import type { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id:   string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
  }
}
