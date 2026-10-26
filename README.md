# CalculixHub

This is a practice app for students training for math competitions (AMC, AIME, USAMO, IMO). You solve problems, and the app tries to figure out how good you are and what to give you next, kind of like how a good tutor would.

[Live demo](https://gmtigrisva123.github.io/CalculixHub/)

## The idea

Most practice apps adapt in a dumb way: you get one right, they give you a harder one. That's basically guessing.

This one instead uses the same kind of math that real standardized adaptive tests use to estimate your actual skill level, with a margin of error attached. It picks the next problem that will tell it the most about you, and it knows when it has seen enough to stop and give you a real answer, instead of a made-up score.

On top of that there's a tutor that asks you guiding questions instead of giving away the answer, a view that shows you *why* you got something wrong (did you not know the method, or did you just slip up doing the arithmetic?), timed contests, a leaderboard, and a feed of other people practicing.

## What's real and what's not (yet)

I want to be upfront about this since it's easy to be fooled by a nice-looking app.

- The actual skill-estimation engine is fully real and working. That's the part I'm proudest of.
- The problem bank is small right now — a few dozen problems, enough to see the engine work, not enough to actually study from seriously.
- The AI tutor needs an API key to talk. Without one, it still works, just with canned responses instead of generated ones.
- The login is fake. It doesn't check a password against anything real, and nothing you do is saved anywhere permanent — refresh the page and it's gone.
- The numbers on the homepage like "1,428 active users" are just made up, for show. They're not counting anyone.
- The leaderboard and discussion threads are also made-up sample data, not real people.

So: real engine, fake user accounts, small content library. Treat it as a demo of the hard part (figuring out what someone knows), not a finished product.

## Running it yourself

You need Node.js installed (version 20, 21, or 22 — not 23 or newer).

```bash
git clone https://github.com/gmtigrisva123/CalculixHub.git
cd CalculixHub
npm ci
npm run dev
```

Then open http://localhost:8000.

That's it — it works with zero configuration. If you want the AI tutor to generate real responses instead of canned ones, copy `.env.example` to `.env` and put in a free key from [Google AI Studio](https://aistudio.google.com/apikey).

## How it's put together, roughly

It's a single web app (React) that runs most of the smart stuff — the skill estimation, the analytics — directly in your browser, so it's fast and works even if the server is slow. A small server (Express) sits behind it mainly to talk to the AI and to serve some sample data.

The one piece of code that matters most, if you want to actually understand how this works, is [`src/domain/irt.ts`](src/domain/irt.ts). That's the whole estimation engine in one file. Everything else is scaffolding around it.

## Contributing

Branch off `main`, make your change, run `npm run lint && npm run build` to make sure nothing's broken, then open a pull request. Keep commits small and focused — one real change per commit is easier for everyone to review.

Things that would genuinely help:
- More practice problems (the bank is small)
- Tests — there currently aren't any, which is the single biggest gap
- Real accounts and saved progress, instead of the current fake login

## License

MIT. See [LICENSE](LICENSE).
