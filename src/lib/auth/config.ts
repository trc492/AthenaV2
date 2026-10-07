import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { databaseManager } from "@/db/database-manager";
import { getOrCreateAuthSecret } from "@/lib/server/env-file";
import "./types";
import { resolveGuestEventLink } from "@/lib/server/guest-link-service";

export const authConfig: NextAuthConfig = {
  secret: getOrCreateAuthSecret(),
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        guestToken: { label: "Guest link", type: "text" },
      },
      async authorize(credentials) {
        if (typeof credentials?.guestToken === "string") {
          const grant = await resolveGuestEventLink(credentials.guestToken);
          if (!grant) return null;
          return {
            id: `guest:${grant.nonce}`,
            name: "Event Guest",
            username: "guest",
            role: "guest",
            guestToken: credentials.guestToken,
          };
        }
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          const username = credentials.username as string;
          const password = credentials.password as string;

          const db = databaseManager.getService();
          if (!db.users) {
            console.error(
              "User management is not supported by this database provider",
            );
            return null;
          }

          const user = await db.users.getByUsername(username);
          if (!user) return null;
          if (user.deactivatedAt) return null;
          const passwordHash = String(user.password_hash || "");

          if (!passwordHash) {
            return null;
          }

          const isValidPassword = await bcrypt.compare(password, passwordHash);

          if (!isValidPassword) {
            return null;
          }

          return {
            sessionVersion: user.sessionVersion ?? 0,
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
    async jwt({ token, user }) {
      const guestToken = user ? user.guestToken : token.guestToken;
      if (guestToken) {
        const grant = await resolveGuestEventLink(guestToken);
        if (!grant) return null;
        return {
          ...token,
          id: `guest:${grant.nonce}`,
          name: "Event Guest",
          username: "guest",
          role: "guest",
          guestToken,
          exp: Math.floor(grant.expiresAt / 1000),
        };
      }
      if (user) {
        token.sessionVersion = user.sessionVersion ?? 0;
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.image = user.image || user.avatarUrl || null;
        token.avatarUrl = user.avatarUrl || user.image || null;
      } else {
        // A valid JWT is not proof that the account still exists or has the
        // same permissions. Refresh from the database on every session check.
        const id = token.id || token.sub;
        if (!id) return null;

        try {
          const db = databaseManager.getService();
          if (!db.users) return null;
          const currentUser = await db.users.getById(String(id));
          if (
            !currentUser ||
            currentUser.deactivatedAt ||
            (token.sessionVersion ?? 0) !== (currentUser.sessionVersion ?? 0)
          )
            return null;

          token.id = String(currentUser.id);
          token.name = currentUser.name;
          token.username = currentUser.username;
          token.role = currentUser.role;
          token.image = currentUser.avatarUrl || null;
          token.avatarUrl = currentUser.avatarUrl || null;
        } catch (error) {
          // Fail closed rather than authorize using stale privileges.
          console.error("Session account lookup failed:", error);
          return null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.guestToken) {
        const grant = await resolveGuestEventLink(token.guestToken);
        if (grant) {
          session.guestEvent = grant;
        }
      }
      if (token && session.user) {
        const userId = token.id || token.sub;
        if (userId) session.user.id = userId;
        session.user.name = token.name;
        session.user.username = token.username;
        session.user.role = token.role;
        session.user.image = token.image;
        session.user.avatarUrl = token.avatarUrl || token.image;
      }
      return session;
    },
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
