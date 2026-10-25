# Google / Facebook sign-in — rollout progress

Updated: 27/09/2026. This work only changed files in CalculixHub; it has not been deployed to production.

## Done

- Added Google and Facebook buttons to sign-in/sign-up, using the existing Supabase OAuth and PKCE flow.
- Checked the provider status before redirecting; when a provider is not enabled, a clear message is shown and email sign-in remains available.
- Checked that the authorization URL belongs to the right Supabase project; the callback returns to the app's own origin.
- Handled callback errors with a safe message; the callback code is removed from the URL after processing.
- Waited for the session to be restored; new users are taken to onboarding.
- Kept the service-role key and client secrets out of the frontend.
- Removed the domain count line and the technical introduction sentence from the sign-in form.
- Used Chrome Computer Use to check Supabase: Google and Facebook were both disabled at the time of the first check.
- Created the Google Cloud project `calculixhub`, named CalculixHub; created the Google Auth Platform configuration after the account owner accepted the terms.
- Created the OAuth web client `CalculixHub Web` with origins `https://calculixhub.com` and `http://localhost:8000`; the redirect URI is the project's Supabase callback. The Google provider was saved and showed as Enabled in Supabase on 26/09.
- Confirmed that the Meta app CalculixHub already exists: App ID `963910706071222`, currently in development mode.
- Saved the Facebook callback `https://wvldvqoajowenfguyvsw.supabase.co/auth/v1/callback`; Meta showed "Changes saved". HTTPS and strict redirect URI matching are enabled.
- Added the email permission after the account owner confirmed; email and public_profile both show "Ready for testing".
- Saved the App ID/App Secret and enabled the Facebook provider in Supabase after the account owner confirmed. Reloaded the page and confirmed Facebook shows as Enabled. The secret only moved from Meta to Supabase and was not written to any file.
- Saved the Education category, the calculixhub.com domain and the Website platform with URL https://calculixhub.com/. Reloaded the page to confirm the data was kept.
- Checked the Supabase Redirect URLs: http://localhost:8000/?auth=callback and https://calculixhub.com/?auth=callback are present. The default Site URL is still the existing Vercel domain.

## Checks

- TypeScript: passed.
- Vitest: 127/127 tests passed, including 4 new tests for the OAuth URL/callback.
- Production build: succeeded before the final wording change. There are warnings about bundle size and modules imported both statically and dynamically; the bundle was not optimized in this round.
- Chrome on localhost: the form shows the Google/Facebook buttons; a disabled Google provider returns a friendly message instead of sending the user to an error page.

## Still to do before release

- Test Facebook Login end to end with an account that has a role in the app; a provider showing Enabled does not prove every Facebook account can sign in.
- Meta is showing business verification and app review requirements for publishing; public Facebook sign-in cannot be considered done until those are resolved.
- Test real sign-in with both providers: new account, existing account, refresh, sign out, declined consent and network errors.
- Check the privacy policy, the data deletion process and the publishing status on each provider.
- After saving the category, Meta now flags a missing 1024px icon and a missing privacy policy URL. The current terms/data deletion URLs point to facebook.com; even though the interface no longer reports data deletion as missing, that is not valid guidance for CalculixHub and must be replaced with a real URL.
- Tried to upload public/icons/icon-1024.png through Chrome; the extension refused because "Allow access to file URLs" is not enabled. Enable that permission, or the account owner uploads the icon.
- As the project owner asked, finish the PR/merge/deploy before entering the real policy URLs and publishing on Meta. The draft content requirements are in docs/meta-publication-draft.md and are not published.
- Deploy the new version, then test again on the real domain. A successful local build does not prove production works.

This report contains no passwords, client secrets or API keys. It does not claim the website is ready to launch or that OAuth works end to end.
