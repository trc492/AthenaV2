import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      username?: string | null;
      role?: string | null;
      email?: string | null;
      image?: string | null;
      avatarUrl?: string | null;
      preferredPartners?: string[] | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    name?: string | null;
    username?: string | null;
    role?: string | null;
    email?: string | null;
    image?: string | null;
    avatarUrl?: string | null;
    emailVerified?: Date | null;
    preferredPartners?: string[] | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string | null;
    role?: string | null;
    image?: string | null;
    avatarUrl?: string | null;
    preferredPartners?: string[] | null;
  }
}
