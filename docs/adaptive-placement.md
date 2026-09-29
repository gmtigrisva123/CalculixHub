# Adaptive placement refresh

The student screen no longer shows an item number, target question count, progress percentage or unsupported percentile claims. A live IRT panel displays ability, posterior SD, model-based tier confidence, matched level, domain coverage, and expandable adaptation logs. It uses the landing page’s warm paper, blue ink, typography, and reduced-motion support. Native radio controls support keyboard answers; an unsure response is scored as incorrect without revealing a hint. Placement responses stay in assessment state, rather than becoming dashboard practice history.

The 3PL engine uses a normalized log posterior to avoid likelihood underflow. Selection maximizes expected posterior variance reduction within the least-covered domains. There is no fixed minimum/maximum test length. Stopping requires coverage (two observations per represented domain), stable tier estimates, and either posterior SD <= 0.32, tier posterior probability >= 0.95, or expected variance reduction < 0.008 for every remaining item. Running out of unique items also ends the assessment. Limited-information and exhausted-bank outcomes are explicitly tentative. These safeguards imply some evidence is always needed; they do not specify a target question count.

The numerical thresholds and bank parameters are provisional product defaults. They are not empirically calibrated, and the classification confidence is conditional on the assumed model and prior. Before interpreting results as standardized scores, fit item parameters to representative responses, simulate exposure and stopping behavior, and validate classification accuracy, bias, and domain coverage on held-out learners. Correct streaks alone do not prove proficiency.

Research basis:
- Bayesian Item Selection Criteria for Adaptive Testing: https://www.cambridge.org/core/services/aop-cambridge-core/content/view/14D47F76D584D619E628BA5B0DAAE463/S0033312300026600a.pdf/bayesian_item_selection_criteria_for_adaptive_testing.pdf
- A New Stopping Rule for Computerized Adaptive Testing: https://pmc.ncbi.nlm.nih.gov/articles/PMC3028267/

Validation: tests cover strong/weak response paths, no repeated items, content coverage, uncertainty after sixteen responses, long-history numerical stability, and bank exhaustion. This implementation follows posterior decision principles; it does not claim to reproduce every rule or calibration in these papers.


## Four estimated paths

Foundation: theta below -0.8. Intermediate: -0.8 to below 0.4 (AMC 10 match). Advanced: 0.4 to below 1.2 (AIME match). Olympiad: 1.2 and above (USAMO, then IMO from 2.0). These thresholds are provisional content routing, not validated contest qualification cutoffs. Tier confidence and classification stopping use the same four regions. Results, profile levels, learning paths and level controls support Intermediate. Existing learner data is not reclassified. For an existing Supabase database, run `supabase/intermediate-path-setup.sql` before saving new Intermediate profiles. The SQL is rerunnable and preserves data.
