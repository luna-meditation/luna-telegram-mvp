# Existing Telegram bot rebranding — 2026-10-18

## Confirmed live change

- Official verified BotFather was opened in the existing logged-in Telegram for macOS.
- `/setname` selected **@lunameditation_bot**, followed by the exact owner-approved name **Meet Luna 🌙**.
- BotFather returned **Success! Name updated.**
- The public page `https://t.me/lunameditation_bot` now returns `og:title=Meet Luna 🌙` and the same username. No new bot was created and no token regeneration/revocation was requested.

## Username is blocked, not complete

The requested **@Meetluna_bot** has not been assigned to the existing bot. Telegram's official BotFather documentation states that an existing bot's username cannot be changed later through its standard management interface: <https://core.telegram.org/bots/features#creating-a-new-bot>. There is no Bot API username-change method. A support exception would need Telegram's confirmation; availability or successful reassignment is not assumed.

With the owner's explicit follow-up authorization, a request was sent to the **verified @BotSupport** at 2026-10-18 13:52 UTC. It identifies only the public old/new usernames and approved display name, asks to preserve the same bot ID/token/users/Stars history, and requests confirmation/owner-verification steps before any coordinated change. Telegram shows the outgoing message as sent; no support response or username-change confirmation has been received. No secrets or user records were included.

Security note: the initial BotFather-history screenshot incidentally included a historical QA-bot token. It was not used, copied into project files or committed. Its current validity is unverified. The owner was informed; separate deliberate QA-token rotation is recommended. The production token was not requested or regenerated. Do not silently rotate either credential as part of this username task.

The native coordinate-control channel did not expose a usable window. AppleScript was also refused by macOS because `osascript` lacks Accessibility access. Known supported keyboard commands were sufficient for the display-name change; unverified focused controls were not activated. Enabling Accessibility would not remove Telegram's username limitation.

Public links, Mini App destinations, referrals, sharing URLs and `BOT_USERNAME` / `VITE_BOT_USERNAME` remain unchanged until successful same-bot username reassignment is confirmed. No replacement bot, user migration, database mutation, entitlement change, payment change or branding deployment was performed.

## Prepared, not deployed

`luna35BotCopy` uses Meet Luna 🌙 for default/EN/RU setup so that a future verified backend release will not overwrite the newly confirmed name with the previous label. Regression tests retain the existing bot username and all supported launch links. Existing localized live names are not claimed verified; the pending backend release updates their labels through the existing authorized setup routine.

## Live read-only checks

- Main frontend: HTTP 200.
- Backend `/health`: HTTP 200, existing production commit `93c9b6a5819296ffb65052248f8b25522995cdad`, existing Supabase project `vkcdtasbdoeilgfucoax`, automatic migrations disabled.
- Existing atomic payment path and Telegram readiness remain reported enabled. No real checkout, balance mutation or new entitlement was tested.
- Railway connector confirms BOT_TOKEN and BOT_USERNAME exist, but OAuth redacts values. No attempt was made to recover or print a production token.

## Remaining same-bot release gate

1. Obtain Telegram/BotFather confirmation that the existing bot ID now has @Meetluna_bot; do not rotate its token or recreate it.
2. Verify that the Bot API identity uses the same numeric ID and that default, EN and RU names match.
3. Update only public username configuration and links; preserve internal user, payment, referral and database identities.
4. Run launch/deep-link/referral/auth/entitlement and webhook checks, plus normal frontend/backend release gates.
5. Publish one coordinated verified release. Do not deploy broken @Meetluna_bot links ahead of Telegram confirmation.
