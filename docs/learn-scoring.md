# Learn bank and provisional rewards

The bank contains 12 existing items and 112 generated training items (four competition preparation tracks, four topics, seven variants). These are authored exercises and parameter variants, not licensed reproductions of official contest papers. Some proof techniques occur in both olympiad tracks. The contest label describes a preparation track; it does not certify the difficulty of an official AMC/AIME/USAMO/IMO question. Several AIME-track answers require more than three digits, so these are extended-format practice.

## Current reward rule

All 124 items use `shared/problemScore.ts`:

`points = 8 + 7 × estimated reasoning steps + 6 × abstraction + 3 × response burden + 2 × diagram indicator`

Response burden is 1 for multiple choice, 2 for numerical answers, 5 for proofs. There is no arbitrary variant bonus, rounding to multiples of five, or bonus just for an IMO label. Steps count substantive deductions rather than arithmetic operations; abstraction represents recognizing a concealed structure, invariant, or proof strategy. These annotations are editorial judgments and need external mathematical review. Equal logical tasks receive equal rewards even across contest tracks. Proof rewards are displayed but cannot currently be earned: Pro proof submission is locked in both UI and API.

These points are **provisional engagement rewards**, not IRT ability estimates, validated difficulty parameters, official contest scores, or claims of a state-of-the-art model. No trained difficulty estimator or student-response calibration has been run. Reading relevant research does not supply the missing response data.

## Research reviewed and implications

- [Livingston, ETS (2020), Basic Concepts of Item Response Theory](https://www.ets.org/Media/Research/pdf/RM-20-06.pdf): distinguishes difficulty, discrimination, guessing and learner ability. More complex models require more data. A reward rubric should not be presented as calibrated ability.
- [Guo et al., ETS (2024), Practical Considerations in Item Calibration With Small Samples Under Multistage Test Design](https://onlinelibrary.wiley.com/doi/10.1002/ets2.12376): evaluates small-sample calibration and fixed-parameter approaches. Results depend on operational pools and an existing calibration; the present bank lacks those anchors.
- [Zotos et al., EDM (2025), Are You Doubtful?](https://educationaldatamining.org/EDM2025/proceedings/2025.EDM.long-papers.104/index.html): combines LLM uncertainty with textual features and a random-forest regressor. Its results concern factual MCQ datasets, not olympiad proofs. It does not validate using an LLM's confidence as our point score.
- [Just Read the Question, EDM (2025)](https://educationaldatamining.org/EDM2025/proceedings/2025.EDM.poster-demo-papers.274/index.html): investigates text-aware generalization to unseen assessment items. Such features could supply cold-start priors, subject to target-domain validation.
- [Can LLMs Estimate Student Struggles? (2025 preprint)](https://arxiv.org/abs/2512.18880): explores human–AI difficulty alignment with simulated proficiency. Simulation should be checked against actual student outcomes before replacing human annotations.

This is a focused review, not an exhaustive survey of all research. No provider API was used to evaluate this bank, and no credentials were transmitted for the review.

## Calibration work that remains

Collect consented, pseudonymous first-attempt responses, item version, hints/reveals, elapsed time and prerequisite track. Keep later attempts separate: retry success and disclosed solutions are not independent test responses. Split validation by student and problem family so parameter variants cannot leak across train/test sets. Pilot Rasch/2PL by topic, check dimensionality, item fit and uncertainty; treat MCQ guessing separately. Do not pick a universal minimum sample count without simulations for the actual test design. Evaluate predictive calibration, error, rank stability and subgroup fairness against held-out human responses. Freeze and version rewards before leaderboard periods rather than retroactively changing earned points.

## Attempts and storage limits

The browser keeps per-account/per-guest practice state. Correct submissions finish a question; three incorrect submissions or requesting the solution forfeit further points. The API claims attempts before awaiting AI/database calls and also closes forfeited practice. Its session ledger is process-local; server restarts or separate serverless instances do not share it. When the existing privileged database writer is configured, persisted history additionally refuses rewards after three attempts or a recorded reveal. The history check is not a cross-instance transactional lock. A production-wide guarantee requires a transactional database function and durable account attempt ledger. Existing credentials and schema were not changed by this task.

## Verification

Automated checks cover bank identifiers, integer rewards, choice answer inclusion, numerical grid widths, balanced and renderable LaTeX, independent binary-string enumeration and modular arithmetic, three-attempt transitions, API lock/reveal behavior, and geometric side-ratio preservation. They do not certify every proof as competition-ready; independent expert review and empirical calibration remain necessary.
