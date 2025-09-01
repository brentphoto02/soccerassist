# Coach Assist App

Cross-platform mobile app (Expo + React Native + TypeScript) for coaches to:

- Set lineups with drag-and-drop on a pitch
- Design drills on a canvas/pitch
- Get time-based substitution alerts (local notifications)
- Choose formations by player count (7v7, 9v9, 11v11 examples)

## Get started

1. Install dependencies

```bash
cd coach-assist-app
npm i
```

2. Start the app

```bash
npx expo start
```

- Press `a` for Android emulator, `i` for iOS (on macOS), or scan the QR with Expo Go on your device.

## Notes
- Dragging of player pins is enabled on the Lineup Builder. The current implementation updates the visual formation in-memory; you can persist custom formations in `zustand` or async storage next.
- Substitution alerts schedule two local notifications: a heads-up (notifyBefore) and the actual substitution time.
- Drill designer includes a palette to add elements; extend with drag handles, snapping, and arrows between elements.
- Uses React Navigation native-stack. Consider Expo Router if preferred.
