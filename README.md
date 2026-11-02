# Circuit

A fun, LLM-powered workout app for the new year. Set your fitness goals and let AI generate personalized workout routines to keep you moving.

**Dreamed up by Seth Cronin. Fully vibe coded by Claude Code.**

## Features

- AI-generated workout routines tailored to your goals
- Cross-platform: iOS, Android, and Web
- Dark mode interface
- Haptic feedback and audio cues
- Progress tracking

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)

### Installation

```bash
# Clone the repository
git clone https://github.com/smcronin/circuit.git
cd circuit

# Install dependencies
npm install
```

## Running the App

### Development (Expo Go)

The quickest way to run the app during development:

```bash
# Start the Expo development server
npm start
```

Then:
- **iOS**: Scan the QR code with your iPhone camera or Expo Go app
- **Android**: Scan the QR code with the Expo Go app
- **Web**: Press `w` to open in your browser

### Platform-Specific Commands

```bash
# iOS Simulator
npm run ios

# Android Emulator
npm run android

# Web Browser
npm run web

# Clear cache and restart
npm run reset
```

## Deployment

### Expo Go (Quick Testing)

Just run `npm start` and scan the QR code with Expo Go on your device. No build required.

### EAS Build (Native Apps)

Build native binaries using [Expo Application Services](https://expo.dev/eas):

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in to your Expo account
eas login

# Build for development (includes dev client)
eas build --profile development --platform ios
eas build --profile development --platform android

# Build for internal testing
eas build --profile preview --platform ios
eas build --profile preview --platform android

# Build for production (App Store / Play Store)
eas build --profile production --platform ios
eas build --profile production --platform android
```

### EAS Submit (App Stores)

```bash
# Submit to App Store
eas submit --platform ios

# Submit to Play Store
eas submit --platform android
```

### Web Deployment (Vercel)

Deploy the web version to [Vercel](https://vercel.com/):

```bash
# Build the static web export
npm run build:web

# Install Vercel CLI
npm install -g vercel

# Deploy (from project root)
vercel

# Deploy to production
vercel --prod
```

Or connect your GitHub repo to Vercel for automatic deployments:

1. Push your code to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Set the build command to: `npm run build:web`
4. Set the output directory to: `dist`
5. Deploy!

### Web Deployment (Netlify)

```bash
# Build the static web export
npm run build:web

# Deploy dist folder to Netlify
# Either drag & drop the dist folder at netlify.com
# Or use Netlify CLI:
npm install -g netlify-cli
netlify deploy --dir=dist --prod
```

## Environment Setup

AI features are paused following a confirmed client-bundle credential exposure.
Do not add provider credentials to this Expo app. All public-prefixed environment
variables are downloadable by users; storing their values in Vercel does not
make them private after bundling.

Programs, saved workouts, timers, history, and manual workout entry remain available.
Re-enabling AI requires an authenticated server endpoint, persistent rate limits,
model/token restrictions, and a dedicated server-only key with a provider spending cap.
See [security controls](docs/SECURITY.md).

Use `npm run build:web` for release builds. It scans source/public environment
variables before export and scans all built artifacts afterward. Any finding or
incomplete scan blocks the Vercel build. `npm run security:test` exercises failures
and verifies that paused AI cannot make a network call.

## Tech Stack

- [Expo](https://expo.dev/) - React Native framework
- [React Native](https://reactnative.dev/) - Cross-platform mobile development
- [Expo Router](https://docs.expo.dev/router/introduction/) - File-based routing
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/) - Animations

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/).

- Free for personal, educational, research, and non-commercial use
- Charitable organizations, educational institutions, and government entities may use freely
- Commercial use requires a separate license

See the [LICENSE](LICENSE) file for details. For commercial licensing inquiries, contact: **sethcronin@gmail.com**

---

Built with Claude Code
