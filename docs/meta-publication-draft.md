# Meta publication — draft to review and deploy

Status on 27/09/2026: not published. Do not use the draft URLs as evidence that the Meta setup is complete.

## Pages the new deploy must have

- `/privacy`: CalculixHub's privacy policy.
- `/data-deletion`: instructions for requesting deletion of an account or its data.
- `/terms`: terms of use, approved by the project owner.

The domain must be the real production domain, publicly reachable over HTTPS. Only enter the URLs in Meta after opening them and checking the real content.

## Privacy content to confirm

CalculixHub uses Supabase for sign-in and user data. Facebook Login requests email and public_profile; it does not request friends, birthday, location or Facebook content. Website data can include profiles, answers, learning progress, Arena registrations, posts, comments, messages and notifications. Public community content must be distinguished from private data.

The sign-in session is stored in the browser to keep the user signed in. The website integrates Vercel Analytics/Speed Insights; the optional AI features may send questions or chat content to the AI provider in use. The policy must describe the actual production configuration after deploy.

The project owner needs to confirm the operating entity's name, the support/privacy contact address, the age groups allowed to use the site, the data retention period and the process for handling requests. Do not invent deadlines or commitments that have not been implemented.

## Data deletion instructions to confirm

The current interface has no self-service way to delete a whole account. A real process has to be chosen and operated: requests through a confirmed support email, or a self-service feature once it is built. The process must verify account ownership before deleting, and describe how community content, messages and backups are actually handled.

Removing CalculixHub's permission from Facebook only stops future Facebook access; it must not be described as deleting CalculixHub data. The instructions URL must not point to Facebook's home page.

## Order of completion

1. Finish the PR/review of the new website version.
2. Review and deploy the policy content together with the data deletion request process.
3. Merge/deploy following the project's process, then check the HTTPS URLs on production.
4. Enter the real URLs, upload the 1024px icon, and test Facebook Login with an account that has a role in the app.
5. Complete the verification/review requirements Meta shows, and only then publish publicly.

Technical configuration reference: https://supabase.com/docs/guides/auth/social-login/auth-facebook
