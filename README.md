# Number Bonds

Number Bonds is a calm, child-friendly practice app for learning how two parts make a whole. It runs locally in a web browser, uses textbook-style circle diagrams, and keeps settings and recent session summaries only in that browser. An optional teacher voice reads each question and gives gentle spoken feedback.

The practice experience includes:

- gentle points and solved-question streaks with no deductions, lives, or speed bonuses;
- adaptive pacing that introduces larger wholes after three confident answers and eases back after two questions that need support;
- fixed 5, 10, or 20-question sessions, 3, 5, 10, or 15-minute sessions, and unlimited practice with an elapsed clock;
- counting hints and a show-answer path so a child cannot become stuck; and
- an aggregate parent report with first-try and solve rates, answer time, hints, reveals, number-range and question-type breakdowns, recent trends, and suggested focus areas.

## Install on a Mac

You need an Intel or Apple Silicon Mac running macOS 11 or newer. The first installation needs an internet connection; starting and using the app afterward does not. After cloning or syncing the repository, no separate backend, database, package manager, or global runtime is required.

### From Finder

1. Double-click **Install.command** and wait for all checks to pass.
2. Press Return when the installer asks, then double-click **Start.command**.
3. Keep the Terminal window open while the app is running. Press Control-C there to stop it.

If macOS blocks a downloaded `.command` file, Control-click it, choose **Open**, and confirm. The scripts never request an administrator password and do not install Homebrew, developer tools, or anything outside this folder.

### From Terminal

Open Terminal, change to this folder, and run:

```sh
./install.sh
./start.sh
```

The installer downloads the matching official Node.js archive into `.runtime`, verifies its pinned SHA-256 checksum, installs locked npm packages, runs lint and tests, and creates a production build. It uses Node.js 24.20.0 on macOS 13.5 or newer and Node.js 22.23.2 on macOS 11 through 13.4. Re-running it is safe.

The startup script finds a free port from 4173 through 4273, binds the complete built app to `127.0.0.1` only, and opens the default browser. There is intentionally no backend service to configure: all exercise logic runs in the browser. Nothing is uploaded, and no account is needed.

## Development

After running the installer, put the private runtime first on your current Terminal's path:

```sh
export PATH="$PWD/.runtime/node/bin:$PATH"
```

Available commands:

```sh
npm run dev       # development server
npm run test      # test suite
npm run lint      # static checks
npm run check:scripts # shell-script syntax checks
npm run build     # production build
npm run verify    # lint, tests, script checks, and build
```

The app uses React, TypeScript, and Vite. It has no backend, external fonts, analytics, advertisements, or cloud storage. Browser data can be cleared from the parent-report screen.

## Scoring, adaptive practice, and reports

Correct answers earn points without penalties: 10 on the first try, 7 on the second attempt, 4 after more attempts, or 1 learning point when the answer is shown. A small streak bonus is capped at 5 points. The score and streak use quiet visual feedback and do not change based on speed.

Adaptive practice is on by default and can be turned off in Adult settings. It always stays inside the selected number range and exercise type. The range expands by at most two after three consecutive first-try answers; two assisted questions lower the current ceiling by one without dropping below the session's starting range.

The parent report is based on the latest 10 summaries stored in the browser. It stores aggregate counters by number band and question type, not a child's name or individual answers. If a session ends after the child has submitted an incorrect answer, that unfinished question is counted as attempted and unsolved so difficult areas are not hidden. “Hint shown” means the counting hint appeared after two misses; it does not claim the child looked at it. Focus and strength suggestions appear only after enough questions have been practiced to avoid drawing conclusions from a tiny sample.

## Teacher voice

Voice feedback is on by default. From the setup screen, an adult can:

- turn narration on or off;
- choose a Warm, Cheerful, or Calm delivery style;
- select an English voice installed on the device; and
- preview the voice before practice.

During practice, **Hear the question again** repeats the current prompt. Spoken questions and feedback supplement the visible text and never block answering.

Narration uses the browser's built-in Web Speech API. The app does not record the child or send question text to its own server. Installed voices generally work offline; a browser-default or enhanced voice may depend on the operating system and could require a voice download. If speech is unavailable or blocked, the complete visual practice flow still works.

## Troubleshooting

- If installation reports a network error, reconnect to the internet and run the installer again. Partial downloads are removed automatically.
- If startup says files are missing, run the installer again.
- If the usual local port is busy, startup automatically tries the next available port.
- macOS versions older than 11 and processor architectures other than Intel x64 or Apple Silicon arm64 are not supported.

The runtime choices follow the official [Node.js 22 build support](https://github.com/nodejs/node/blob/v22.x/BUILDING.md), [Node.js 24 build support](https://github.com/nodejs/node/blob/main/BUILDING.md), and [Vite requirements](https://vite.dev/guide/).
