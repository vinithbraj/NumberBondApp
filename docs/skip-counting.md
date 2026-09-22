# Hop & Count design notes

## Games reviewed

- [Turtle Diary: Counting by 2](https://www.turtlediary.com/game/counting-by-2.html) connects skip-counted numbers to reveal a picture. The useful idea is a visible action for each numerical step.
- [Skip Counting, by I Teach Tiny Humans](https://apps.apple.com/us/app/skip-counting/id571506346) offers configurable counting steps from 1 to 10, sequence lengths, and hints. Hop & Count keeps the choice of step visible and uses a small, fixed round for younger children.
- [Rudolph Academy: Skip Counting Game](https://rudolphacademy.com/educational-games/math-games/number-sense-games/skip-counting/) uses missing-number sequences, rounds, points, and celebration. Hop & Count introduces forward patterns before missing interior numbers and uses tap choices instead of typed answers.

These product descriptions informed the interaction design. The frog, pond illustrations, layout, and implementation are original; no third-party assets or code were copied. These are design references, not evidence of measured learning outcomes.

## Teaching and play

The learner chooses a step from 1 to 10. The lesson starts at zero and takes five equal hops. Each hop highlights a number, adds one group of dots, and displays the matching addition sentence. A child can control the pace or watch automatic hops with the existing teacher voice.

A game has eight questions. The first four ask for the next number; the remaining four hide an interior number. Every sequence has four consecutive multiples of the chosen step, bounded by ten times that step (at most 100). Three distinct answer choices stay in the same bounds. Incorrect options become unavailable, with a gentle prompt to add the chosen step again. Help counts the intervening numbers one by one. Showing an answer gives a learning point and allows progress.

The game separates rewards for participation from performance measures. Stars celebrate completed practice, including revealed answers. Results separately count independently correct first attempts, solved questions, shown answers, and hints. A question attempted but unfinished when the round ends is included in the attempted total. Untouched games are not saved.

The default is an elapsed clock without a deadline. Optional two- and three-minute countdowns provide short challenges. Points have no speed multiplier or deductions. The pause button and automatic pause on tab hiding protect thinking time. Resuming requires a tap. A delayed timer callback cannot extend the deadline or allow a late answer to earn points.

## Integration and verification

The activity is accessible from both first-run onboarding and the existing setup screen. Number-bond exercises, settings, scoring, and reports retain their existing storage schema. Counting progress has a separate versioned record and a ten-session limit. Storage failures do not interrupt play.

The implementation uses React, TypeScript, CSS, and inline SVG, without additional production dependencies. Native buttons provide keyboard and touch input. Visible instructions accompany narration, feedback is announced through a status region, focus moves to the next action after an answer, and reduced-motion settings disable decorative animation.

Automated coverage checks all counting steps, question bounds, unique answer choices, reward totals, duplicate submissions, help and reveal accounting, pause/resume, delayed timer callbacks, the deadline boundary, corrupted or unavailable storage, lessons, complete rounds, replay, automatic tab pausing, and navigation between activities. Existing number-bond tests are part of the same verification command: `npm run verify`.
