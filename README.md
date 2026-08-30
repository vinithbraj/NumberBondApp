# Number Bonds

Number Bonds is a calm, child-friendly practice app for learning how two parts make a whole. It runs locally in a web browser, uses textbook-style circle diagrams, and keeps settings and recent session summaries only in that browser.

## Install on a Mac

You need an Intel or Apple Silicon Mac running macOS 11 or newer. The first installation needs an internet connection; starting and using the app afterward does not.

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

The startup script finds a free port from 4173 through 4273, binds the server to `127.0.0.1` only, and opens the default browser. Nothing is uploaded, and no account is needed.

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

The app uses React, TypeScript, and Vite. It has no backend, external fonts, analytics, advertisements, or cloud storage. Browser data can be cleared from the app's progress screen.

## Troubleshooting

- If installation reports a network error, reconnect to the internet and run the installer again. Partial downloads are removed automatically.
- If startup says files are missing, run the installer again.
- If the usual local port is busy, startup automatically tries the next available port.
- macOS versions older than 11 and processor architectures other than Intel x64 or Apple Silicon arm64 are not supported.

The runtime choices follow the official [Node.js 22 build support](https://github.com/nodejs/node/blob/v22.x/BUILDING.md), [Node.js 24 build support](https://github.com/nodejs/node/blob/main/BUILDING.md), and [Vite requirements](https://vite.dev/guide/).
