// import "dotenv/config";
// import passport from "passport";
// import { Strategy as GitHubStrategy } from "passport-github2";
// import { Strategy as GoogleStrategy } from "passport-google-oauth20";
// import { Strategy as FacebookStrategy } from "passport-facebook";

// import {
//   findUserByProvider,
//   createUserByProvider,
// } from "../../modules/auth/auth.model.js";


// passport.use(
//   new GitHubStrategy(
//     {
//       clientID: process.env.GITHUB_CLIENT_ID,
//       clientSecret: process.env.GITHUB_CLIENT_SECRET,
//       callbackURL: "/auth/github/callback",
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       try {
//         let user = await findUserByProvider("github", profile.id);

//         if (!user) {
//           user = await createUserByProvider({
//             provider: "github",
//             providerId: profile.id,
//             username: profile.username,
//             displayName: profile.displayName,
//             avatar: profile.photos?.[0]?.value || null,
//             role: "user",
//           });
//         }

//         return done(null, user);
//       } catch (error) {
//         console.error("GitHub Auth Error:", error);
//         return done(error, null);
//       }
//     },
//   ),
// );

// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: "/auth/google/callback",
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       let user = await findUserByProvider("google", profile.id);

//       if (!user) {
//         user = await createUserByProvider({
//           provider: "google",
//           providerId: profile.id,
//           email: profile.emails?.[0]?.value || null,
//           username: profile.emails?.[0]?.value || null,
//           displayName: profile.displayName,
//           avatar: profile.photos?.[0]?.value || null,
//           role: "user",
//         });
//       }

//       return done(null, user);
//       return done(null, profile);
//     },
//   ),
// );

// passport.use(
//   new FacebookStrategy(
//     {
//       clientID: process.env.FACEBOOK_CLIENT_ID,
//       clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
//       callbackURL: "/auth/facebook/callback",
//       profileFields: [
//       "id",
//       "displayName",
//       "photos",
//       "email"
//     ],
//     },
//     async (accessToken, refreshToken, profile, done) => {
//         let user = await findUserByProvider("facebook", profile.id);

//         if (!user) {
//           user = await createUserByProvider({
//             provider: "facebook",
//             providerId: profile.id,
//             email: profile.emails?.[0]?.value || null,
//             username: profile.emails?.[0]?.value || null,
//             displayName: profile.displayName || null,
//             avatar: profile.photos?.[0]?.value || null,
//             role: "user",
//           });
//         }

//         return done(null, user);
//       },
//     ),
//   );


// export default passport;




import "dotenv/config";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";

import {
  findUserByProvider,
  createUserByProvider,
  findUserByEmail,      // Add this to check existing emails
  linkProviderToUser,   // Add this to link accounts (or implement in model)
} from "../../modules/auth/auth.model.js";

// Helper function to handle provider OAuth logic safely across strategies
async function handleOAuthCallback({ provider, profile, done }) {
  try {
    const providerId = profile.id;
    const email = profile.emails?.[0]?.value || null;
    const displayName = profile.displayName || profile.username || null;
    const avatar = profile.photos?.[0]?.value || null;

    // 1. Check if user exists with this provider ID (e.g., already logged in with Google before)
    let user = await findUserByProvider(provider, providerId);
    if (user) return done(null, user);

    // 2. If an email exists, check if a user with this email already registered locally
    if (email) {
      user = await findUserByEmail(email);
      if (user) {
        // Option A: Link provider ID to the existing account
        if (typeof linkProviderToUser === "function") {
          user = await linkProviderToUser(user.id, provider, providerId);
        }
        return done(null, user);
      }
    }

    // 3. Create a brand new user record if no provider match and no email match
    user = await createUserByProvider({
      provider,
      providerId,
      email,
      username: email || profile.username || null,
      displayName,
      avatar,
      role: "user",
    });

    return done(null, user);
  } catch (error) {
    console.error(`${provider} Auth Error:`, error);
    // Returning error to done prevents Node.js process from crashing
    return done(error, null);
  }
}

// --- GitHub Strategy ---
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "/auth/github/callback",
      scope: ["user:email"], // Required to fetch email from GitHub
    },
    async (accessToken, refreshToken, profile, done) => {
      await handleOAuthCallback({ provider: "github", profile, done });
    }
  )
);

// --- Google Strategy ---
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      await handleOAuthCallback({ provider: "google", profile, done });
    }
  )
);

// --- Facebook Strategy ---
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: "/auth/facebook/callback",
      profileFields: ["id", "displayName", "photos", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      await handleOAuthCallback({ provider: "facebook", profile, done });
    }
  )
);

export default passport;