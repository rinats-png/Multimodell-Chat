# Brief: SynthrAI after the rebuild. What is it now, how many people would use it, and how should it launch?

Date: 2026-11-01. Answer in English. Name the product "SynthrAI". Third council.

## What happened since the last two councils
Council 1 (German site) and council 2 (English site) both said NICHE, GO WITH CONDITIONS on Option B: bring your own key first, professionals who check decisions with several AIs, a two-market test (German live, one English landing page), about 90 payers and EUR 2,600 a month in 12 months as the median estimate. Weakest pillars were real demand, offer strength and product love (5/10 each). Council 2 said the moat is thin and that the product must produce something people pass on.

**The founder then rebuilt the product around that advice. Judge the product as it is now (all stated, built and tested unless marked):**
1. **Decision report** (the new core): from any debate the app produces a scored report: options A to E, a 0 to 10 score from each AI per option, the average and a verdict band computed by the app (GO, GO with conditions, Reshape, Don't), agreement level, where the AIs fought, the strongest objection, conditions, next steps, the cheapest test and kill criteria. Shareable by a revocable link (only a hash stored, the reader sees the report, never the debate), print to PDF, and Markdown export.
2. **Automatic council session**: one switch runs three rounds (opening, debate, vote) with all active AIs, then writes the report. This is the Roast Room format inside the product, with real models from different providers instead of personas of real people.
3. **13 ready-made councils in four groups**, each with fixed roles: Decide (business decision, pricing and offer, career), Test the idea (idea check, idea workshop, roast, pre-mortem), Build the app (plan your app, code review, security check, audit an existing app, launch readiness), Growth (marketing, first 100 users). Roles are invented schools of thought, not real people. Plus six decision templates that pre-fill the question.
4. **Cost controls**: platform key hard-capped at EUR 50 a month, 40% of that reserved for trial users; Starter is a one-time trial of 60,000 tokens (about one debate) on the platform key, unlimited with own key; daily limits Pro 150,000 and Workspace 600,000 tokens; council sessions limited to 6 starts per hour. Plans unchanged: Pro EUR 29 (500,000 tokens/month), Workspace EUR 79 (2.5M tokens).
5. **Brand and marketing**: name and wordmark "SynthrAI, AI Discussion Room"; a 50-second promo video in German and English whose message is "one AI mostly says yes; several AIs that disagree give you a tested decision".
6. **Deployed** at a public Vercel address. Not yet done (stated): production secrets (payments, rate limiting, service keys) are not configured, so sign-up, payments and live model calls do not work in production yet; the interface is German only (the English site from council 2 is not built, only the English video); report quality with real models is untested; no users, no revenue, no email list.

## The decision
How should SynthrAI launch now, and how many people could use and pay for it in 12 months? Every seat must give its own estimate of reachable users and payers in 12 months, compare it with council 2 (about 20,000 reached, about 90 payers), say "niche" or "mass market", and say whether the decision report and the councils change demand, offer and product love, and by how much.

Options:
- **A. Broad public launch now.** German and English, free trial on the platform key, all 13 councils, promo video as paid and organic ads to everyone who uses ChatGPT, Claude or Gemini.
- **B. Focused launch around the decision report.** Sell "a tested decision in 10 minutes" to founders, freelancers and small-business owners with real money decisions. German first plus an English landing page, the shared report link as the growth loop, own key or the capped trial, one paid tier.
- **C. Private beta first.** Configure production, translate the interface, then 30 hand-picked users for 30 days with real reports before any public launch.
- **D. Do not launch.** Keep it a personal tool or open-source it.

## The business (assumed unless stated)
Solo founder, part-time (about 10 hours a week), cash about EUR 2,000, no audience. One debate costs about 20,000 to 60,000 tokens; a full council session with report about 60,000 to 150,000 (assumed). Competition (stated): open-source "LLM council" tools, AIQuorum, AskQuorum, Suprmind, OpenRouter chat, Poe, TypingMind and the labs; none is known to ship a scored, shareable decision report (assumed, quick search only). Market numbers are the seats' own assumptions.

## Success
500 paying users within 12 months, or 50 paying users within 3 months. (assumed)

## The founder's lean
Believes the report, the councils and the video turn SynthrAI from a niche tool into something many people want, and wants to go broad now. The council should test that lean, not echo it.

## Seats and weights
| Seat | Weight | Why |
|---|---|---|
| Graham | 3 | Real demand: does the report make people want it |
| Hormozi | 3 | Offer and price: is "a tested decision" worth paying for |
| Gary V | 2 | Attention: video and shared reports as distribution |
| Bezos | 2 | Strategy and reversibility of a broad launch |
| Buffett | 2 | Downside: platform-key cost, EUR 2,000 cash |
| Naval | 2 | Leverage: shared reports and content as owned assets |
| Sara | 2 | Product love from zero, self-funded growth |
| Martell | 1 | Founder time: 10 hours a week |
| Elon | 1 | Real constraints: what is missing before anything works |
