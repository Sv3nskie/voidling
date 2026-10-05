# Your art for Voidling

Put your images in this folder (subfolders are fine) and name them after what they replace.
Anything you don't provide keeps the built-in art, so you can add things one at a time.

- **Format:** PNG with a transparent background (WebP, JPG and SVG work too).
- **Facing:** draw characters, guns and bullets **facing right**. The game mirrors them.
- **Size:** any pixel size. The game scales each image to the size in the tables below
  (in game units; the Voidling is 24 units tall). About 4–8 pixels per unit looks sharp,
  so a 128–256 px tall character is plenty.
- **Names** are not case sensitive, and spaces or dashes count as `_`.

## Animations

Three ways to give something frames:

| You name the files | What happens |
|---|---|
| `coin.png` | one image |
| `coin_1.png`, `coin_2.png`, `coin_3.png` … | frames, played in number order |
| `coin_strip8.png` | 8 frames side by side in one image, all the same width |

Animations loop at 10 frames per second unless you set `fps` (see Tuning below).
Animations that play once are marked **once**. They hold their last frame.

## Player

Each one falls back to the next: if there's no `player_run`, it uses `player_idle`, then `player`.

| Name | When | Size, anchor |
|---|---|---|
| `player` or `player_idle` | standing | 32 tall, feet at the bottom of the image |
| `player_run` | running | same |
| `player_jump` | going up | same |
| `player_fall` | falling | same |
| `player_glide` | holding jump to float | same |
| `player_dash` | chomp-dash | same |
| `player_shoot` | right after shooting or throwing | same |
| `player_hurt` | just got hit | same |
| `player_die` | dying, **once** | same |

## Enemies

| Name | What | Size, anchor |
|---|---|---|
| `alien` or `alien_walk` | walking alien | about 2.4× its body size, feet at the bottom |
| `spiky` or `spiky_walk` | spiky alien (can't be stomped) | same (falls back to `alien`) |
| `bat` | void bat, flapping | 2.2× body, centered |
| `jelly` | bouncy jellyfish | 2.6× body, centered |
| `maw` | plant monster head. Frames go from **closed to wide open** | 2.4× body, centered |
| `ufo` | saucer | 2.8× body wide, centered |
| `alien_die`, `spiky_die`, `bat_die`, `ufo_die`, `maw_die` | death animation, **once** | same as the enemy |
| `bullet_enemy` | UFO shot | about 9 tall, centered |

Without `_die` frames, enemies use the built-in death animations: flattened by a stomp,
knocked flying by a dash, spiraling bats, exploding UFOs, wilting plants.

## Items and power-ups

| Name | Size |
|---|---|
| `coin` | 18 tall. A single image is turned to look like it spins, frames spin it your way |
| `heart` | 21 tall |
| `diamond` | 25 tall |
| `rock` | 18 tall |
| `bomb` | 22 tall |
| `gun_blaster`, `gun_spread` (or one `gun`) | 24 wide, pointing right, held at the grip |
| `buff_shield`, `buff_boots`, `buff_wings`, `buff_hook`, `buff_freeze`, `buff_heartup` | 24 tall, shown inside a glass bubble and in the HUD |

## Shooting and effects

| Name | What | Size |
|---|---|---|
| `bullet_blaster`, `bullet_spread` (or one `bullet`) | your shots, pointing right | 20 wide |
| `muzzle_flash` (or `muzzle_blaster`, `muzzle_spread`) | flash at the gun when firing, **once** | 24 tall |
| `hit` | a shot hitting something, **once** | 26 tall |
| `explosion` | bomb explosion, **once** | about 200 tall |

## Islands (platforms)

Two ways to draw an island:

- **One image:** `platform.png` is stretched to each island's width. Good for chunky floating rocks.
- **Three pieces that tile:** `platform_left.png`, `platform_middle.png` (repeated to fill
  the width) and `platform_right.png`. Good when islands should look the same at any width.

The walkable top edge is assumed to be 12% down from the top of the image (grass sticking up
above it is fine). Change it with the `surface` setting if your art differs.

You can be more specific. The most specific name that exists wins:

| Name | Used for |
|---|---|
| `platform_crumble` | islands that break when you stand on them |
| `platform_moving` | moving islands |
| `platform_beacon` | checkpoint islands |
| `platform_zone1` … `platform_zone5` | every island in that zone |
| `platform_crumble_zone3` | combinations of both |

Each of these also works as `_left` / `_middle` / `_right` pieces.

## World

| Name | What | Size |
|---|---|---|
| `background` or `background_zone1` … `background_zone5` | fills the screen behind everything, fades between zones | full screen |
| `beacon`, `beacon_lit` | checkpoint crystal, before and after you land on it | 70 tall, bottom on the island |
| `shop`, `shop_closed` | trading post, open and after you've used it | 90 tall, bottom on the island |
| `spikes` | spike strip, repeated along it | 15 tall |

## Tuning: settings.json (optional)

Make a file `settings.json` in this folder to adjust any art by name. A setting on a short
name also applies to longer names (`player` covers `player_run`, `player_jump`, …):

```json
{
  "player":   { "scale": 1.2, "y": 2, "fps": 12 },
  "alien":    { "scale": 0.9 },
  "coin":     { "fps": 16 },
  "platform": { "surface": 0.2, "overhang": 0.05 },
  "platform_middle": { "height": 56 },
  "background": { "layers": true }
}
```

| Setting | Meaning | Default |
|---|---|---|
| `scale` | bigger or smaller than the default size | 1 |
| `x`, `y` | shift in game units (y down is positive) | 0 |
| `fps` | animation speed | 10 |
| `glow` | the purple glow behind the player | true |
| `surface` | islands: where the walkable edge is, 0 = top of the image, 1 = bottom | 0.12 |
| `overhang` | single-image islands: how far the art sticks out past the edges (0.05 = 5% per side) | 0.04 |
| `height` | three-piece islands: height in game units | 44 |
| `layers` | background: also draw the built-in stars, planets and haze on top | false |

## After adding art

Run `node tools/build.mjs` (or ask Claude). It lists the files for the game and
publishes them with the site. The browser console (F12) shows which art was loaded.
