# Brief: Wie viele Leute würden SynthrAI nutzen, oder ist es eine Nische?

Date: 2026-11-01. Language note for the seats: answer in English (the room's templates are English); name the product "SynthrAI".

## The decision
Should the founder launch SynthrAI as a public paid product, and who is it for? The Chair's main question: **how many people could plausibly use it and pay for it, or is it a niche?** Every seat must give its own estimate of the reachable user base (rough numbers, with the assumption behind them) and say "niche" or "mass market" and why.

Options:
- **A. Public SaaS for a broad audience.** Launch to everyone who uses ChatGPT, Claude or Gemini. Free tier plus Pro (EUR 29/month) and Workspace (EUR 79/month), platform key included.
- **B. Focused niche.** Aim at professionals who already use several models to check decisions (founders, consultants, analysts, engineers, researchers). Bring-your-own-key first, small paid tier, grow through content and demos.
- **C. Don't launch publicly.** Keep it a personal tool, or open-source it, and spend the time elsewhere.

## The product
SynthrAI ("AI Discussion Room"): a group chat where several LLMs (ChatGPT, Claude, Gemini, Grok, DeepSeek, Kimi and more via OpenRouter) discuss one question with the user and with each other. Each AI has a role, they disagree on purpose, a moderator picks who speaks, the app shows agreement or disagreement between models, and the user gets a result. Built: Next.js, Supabase with row level security, Stripe, German and English interface text, glass design. It runs; no real users yet; no revenue. Own API keys are allowed in every tier.

## The business (all numbers assumed unless stated)
- Solo founder, German-speaking, part-time hours, no marketing budget, no audience.
- Plans (stated): Starter free with 15,000 tokens a month; Pro EUR 29 for 500,000 tokens; Workspace EUR 79 for 2.5 million tokens.
- One debate with 3 to 6 models costs roughly 20,000 to 60,000 tokens (assumed). On the platform key that is a real cost per user; the 500,000-token Pro allowance covers roughly 10 to 25 debates (assumed).
- Similar tools already exist (stated, from a quick search): several open-source command-line "LLM council" tools, an iOS app called AIQuorum, AskQuorum, Suprmind, and multi-model chat in tools like OpenRouter's chat room, Poe and TypingMind. The big labs also add features that compare models.
- Market numbers the seats may use (assumed, not verified): hundreds of millions of people use ChatGPT each week; paying subscribers are a small share; people who actively use two or more different chat models are a small share of those, perhaps a few percent; people willing to pay extra for a multi-model tool are far fewer.

## Resources and limits
Cash: personal, small (assumed EUR 2,000 for hosting, tokens and a domain). Time: about 10 hours a week. Deadline: decide within one month.

## Success
500 paying users within 12 months, or a clear signal of 50 paying users within 3 months. (assumed)

## The founder's lean
Leans toward A because the product is finished and feels broad ("anyone who uses AI"). Fears it may be a niche. The council should test the lean, not echo it.
