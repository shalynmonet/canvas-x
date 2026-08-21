# Canvas Creator Hub

Build "CanvOps" — a UGC collab organizer for creators managing multiple 

brand deals, with a subscription paywall, real-creator-calibrated defaults, 

and an autonomous reminder agent.

## AUTH & ACCOUNT

- Email/password signup and login

- New users get a 7-day free trial, then must subscribe to continue

- On signup, collect: name, phone number (for reminders — explain this is 

  used for their own accountability texts), reminder_time (optional, 

  time picker, default blank), reminder_enabled (bool, auto-true if 

  reminder_time is set)

## SUBSCRIPTION / PAYMENTS

- Integrate Stripe Checkout for a monthly subscription ($9/mo — adjust as 

  needed)

- After trial expires, gate the app behind an "Upgrade to continue" screen 

  that opens Stripe Checkout

- On successful payment, unlock full access automatically — no manual 

  approval step. This is the Payments Agent: it runs the paywall logic 

  and unlocks access the instant Stripe confirms payment, with no human 

  touching the transaction.

- Store subscription_status (trialing/active/canceled) on the user record

## DATA MODEL

Table: collabs

- id, user_id, brand_name, social_accounts (text, comma-separated), 

  start_date, source (text), main_poc (text), warmup_days (int, 2-5), 

  daily_engagement_minutes (int, 10-45), base_pay (decimal), 

  cpm_rate (decimal — $ per 1,000 views), min_daily_posts (int), 

  pay_frequency (enum: weekly/biweekly/monthly/on completion), 

  status (active/completed/paused), created_at

Table: daily_logs

- id, collab_id, log_date, warmed_up (bool), posted_count (int), 

  notes (text, optional) — one row per collab per day

Table: view_logs

- id, collab_id, day_number (int, 1-15), view_count (int), logged_at

Table: calibration_results

- collab_type (text), avg_warmup_days, avg_engagement_minutes, 

  avg_min_posts, response_count

Table: reminder_logs

- id, user_id, sent_at, collab_ids_flagged (text)

## SCREEN 1: Add/Edit Collab

Fields in this order:

1. Brand name

2. Designated social accounts

3. Start date

4. Source (e.g. "inbound DM", "agency", "referral") — also used to match 

   against calibration_results for suggested defaults

5. Main POC

6. Warmup timeframe: stepper/select, 2-5 days — if a matching 

   calibration_results row exists for this source/type, pre-fill with 

   the calibrated average and show a badge: "Recommended based on 

   [N] creator responses via Terac" (user can override)

7. Daily engagement time once warmed up: stepper/select, 10-45 min 

   (5-min increments) — same calibration pre-fill behavior

8. Pay rate: base pay ($) + per-CPM rate ($ per 1,000 views)

9. Minimum daily posts (number input)

10. Pay frequency (dropdown)

On submit, compute warmup end date = start_date + warmup_days.

## SCREEN 2: Home (calendar dashboard)

- Today's date prominently at top

- 7-day calendar strip (current week) — tapping a past date shows that 

  day's logged status per collab; tapping today shows the live checklist

- One checklist card per active collab, for today:

  - Within warmup window: single checkbox "Warmed up today"

  - Past warmup window: "Engaged today (X min)" checkbox + checkboxes 

    for posts up to min_daily_posts

  - Visual indicator: red/amber if incomplete for today, green if fully 

    checked off

## SCREEN 3: Collab detail view

- All fields from creation, editable

- History log of past days (warmup/engagement/post status)

- "Log 15-day views": numbered slots for day 1-15 post-start (only show 

  slots for days that have occurred), each takes a view count input

- Live earnings estimate, prominently displayed and labeled as an estimate:

  estimated_earnings = base_pay + (sum of logged 15-day views / 1000 * cpm_rate)

## SCREEN 4: Calibration survey (Terac-powered)

- Short 4-question survey: present 3-4 collab scenarios (e.g. "new fashion 

  brand," "established beauty brand," "app/software brand"), ask 

  respondents their ideal warmup length (2-5 days), daily engagement 

  time (10-45 min), and sustainable min posts/day for each

- This survey is distributed via the Terac API/MCP to real respondents

- Results populate the calibration_results table, which feeds the 

  Screen 1 auto-suggest behavior above

- Keep a simple internal view showing response_count per category, so 

  you can screenshot the before/after (blank defaults vs. calibrated 

  defaults) for judging

## REMINDER AGENT (Linq)

- Scheduled job, runs every 15-30 min

- For each user where reminder_enabled = true and current time is within 

  15 min of their reminder_time:

  1. Check today's daily_logs across their active collabs

  2. If any active collab is incomplete for today (warmed_up/engaged not 

     checked, OR posted_count < min_daily_posts):

     - Call the Linq API to send an iMessage to the user's own number

     - Message names the specific incomplete collab(s): 

       "Canvas: You haven't logged [Brand Name] yet today — 2 posts 

       still needed. Tap to check off: [link back into app]"

     - Log it in reminder_logs

  3. If everything's checked off, skip — no message

## STYLE

Clean, minimal, mobile-first. This is a tool a creator checks daily 

between filming content — prioritize speed of checking things off over 

dense information display.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://canvas-x.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/38185f51-315f-4c20-af72-3f160a961ce6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
