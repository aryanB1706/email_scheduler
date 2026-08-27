import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env } from "./env";
import { prisma } from "../db/prisma";

passport.use(
  new GoogleStrategy(
    {
      clientID: env.google.clientId,
      clientSecret: env.google.clientSecret,
      callbackURL: env.google.callbackUrl,
      scope: ["profile", "email"],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value?.toLowerCase();
        const name = profile.displayName || null;
        const avatarUrl = profile.photos?.[0]?.value || null;

        if (!email) return done(new Error("Google profile has no email"), undefined);

        // Upsert user: find by googleId OR email (link same email to googleId if user existed)
        let user = await prisma.user.findUnique({ where: { googleId } });
        if (!user) {
          // Check if email already exists without googleId (should not happen due to unique, but handle)
          const existingByEmail = await prisma.user.findUnique({ where: { email } });
          if (existingByEmail) {
            // Link googleId to existing email user
            user = await prisma.user.update({
              where: { id: existingByEmail.id },
              data: { googleId, name: name || existingByEmail.name, avatarUrl: avatarUrl || existingByEmail.avatarUrl },
            });
          } else {
            user = await prisma.user.create({
              data: { googleId, email, name, avatarUrl },
            });
          }
        } else {
          // Update name/avatar if changed
          if (user.name !== name || user.avatarUrl !== avatarUrl || user.email !== email) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { email, name, avatarUrl },
            });
          }
        }

        return done(null, user);
      } catch (err) {
        return done(err as Error, undefined);
      }
    }
  )
);

// We use JWT, not sessions — but passport still requires serialize (no-op)
passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((obj: any, done) => done(null, obj));

export default passport;
