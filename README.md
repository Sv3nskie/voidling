# Voidling

**The Void is rising. Climb.**

A 2D arcade climber in space. You are a Voidling, a small scrap of living void, escaping the dark tide that swallowed the world below. Climb floating islands through five zones, stomp aliens, grab guns and bombs, find hidden power-ups, and see how high you can get before the Void catches you.

Everyone climbs the same tower, so heights are comparable between players.

- **Beacons** are checkpoints: land on one to save it.
- **Diamonds** hide in hard-to-reach spots. Hold up to 3: when you die, one brings you back to your last checkpoint.
- **Collect everything:** guns add shots, stones and bombs stack, and you carry them all at once (switch with R).
- **Coins** come from islands and from defeating enemies (quick kills chain for a bonus). Spend them at the **trading post** every 100 m on hearts, shields, weapons, power-ups and diamonds.
- **Settings** (from the title or pause menu): sound, screen shake, cinematic effects (bloom, film grain, light shafts) and 3D islands.

- **Play in your browser:** https://sv3nskie.github.io/voidling/ (works on phones too; add it to your home screen to play offline)
- **Android app:** download the APK from the [latest release](https://github.com/Sv3nskie/voidling/releases/latest)

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | ← → or A D | Left stick / d-pad | ◀ ▶ |
| Jump, double jump (hold to float) | Space / W / ↑ | A | JUMP |
| Chomp-dash | X / C / K | B | CHOMP |
| Throw / shoot (auto-aims) | Shift / E, or click to aim | X / RT, right stick aims | SHOOT |
| Switch item | R / Tab / 1-4, mouse wheel, or click the item bar | RB | Tap the item bar |
| Grapple hook | G / Q, or right-click | Y / LB | HOOK |
| Drop through a platform | ↓ / S | Stick down | |
| Pause | P / Esc | Start | II button |

## Project layout

| Folder | What it is |
|---|---|
| `voidling/` | The game: plain JavaScript and canvas, no build step needed to edit it |
| `tools/build.mjs` | Builds `voidling/` into the website and into the Android app |
| `docs/` | The website, served by GitHub Pages (generated, don't edit by hand) |
| `app/` | Flutter Android app that runs the game full screen and offline |
| `tools/make-icons.py` | Renders the app icons from the game's own drawing code |

## Building

After changing anything in `voidling/`:

```sh
node tools/build.mjs          # updates docs/ (website) and app/assets/game/ (Android)
```

Commit and push to update the website. To build the Android app:

```sh
cd app
flutter build apk --release   # app/build/app/outputs/flutter-apk/app-release.apk
```

The release APK is signed with Flutter's debug key, which is fine for installing on your own phone. Publishing on Google Play needs your own signing key first.

## Credits

Fonts: [Bungee](https://github.com/djrrb/Bungee) and [Fredoka](https://github.com/hafontia/Fredoka-One), both under the SIL Open Font License 1.1 (see `voidling/fonts/`). All other art and sound is generated in code.
