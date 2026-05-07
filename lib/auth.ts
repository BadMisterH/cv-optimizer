import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import Database from "better-sqlite3";

// Pour la prod (Vercel/serverless), remplacer par Postgres :
// import { Pool } from "pg";
// database: new Pool({ connectionString: process.env.DATABASE_URL })

export const auth = betterAuth({
  database: new Database("./auth.db"),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 jours
    updateAge: 60 * 60 * 24, // refresh la session toutes les 24h
  },
  plugins: [nextCookies()],
});
