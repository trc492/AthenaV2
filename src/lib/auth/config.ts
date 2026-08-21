import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { databaseManager } from "@/db/database-manager";
import { getOrCreateAuthSecret } from "@/lib/server/env-file";
import "./types";

export const authConfig: NextAuthConfig = {
  secret: getOrCreateAuthSecret(),
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          const username = credentials.username as string;
          const password = credentials.password as string;

          const db = databaseManager.getService();
          if (!db.query) {
            console.error("Database service does not support direct SQL queries");
            return null;
          }

          const result = await db.query<{
            id: string;
            name: string;
            username: string;
            role: string;
            password_hash: string;
            avatarUrl: string | null;
          }>(
            `
            SELECT id, name, username, role, password_hash, avatarUrl
            FROM users
            WHERE username = @username
          `,
            { username },
          );

          if (result.recordset.length === 0) {
            return null;
          }

          const user = result.recordset[0];
          const passwordHash = String(user.password_hash || "");

          if (!passwordHash) {
            return null;
          }

          const isValidPassword = await bcrypt.compare(password, passwordHash);

          if (!isValidPassword) {
            return null;
          }

          return {
            id: user.id.toString(),
            name: user.name,
            username: user.username,
            role: user.role,
            image: user.avatarUrl || null,
            avatarUrl: user.avatarUrl || null,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({
      token,
      user,
    }: {
      token: any;
      user: any;
    }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.image = user.image || user.avatarUrl || null;
        token.avatarUrl = user.avatarUrl || user.image || null;
      }
      return token;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any; token: any }) {
      if (token && session.user) {
        session.user.id = token.id || token.sub;
        session.user.username = token.username;
        session.user.role = token.role;
        session.user.image = token.image;
        session.user.avatarUrl = token.avatarUrl || token.image;
      }
      return session;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
export const authOptions = authConfig;
