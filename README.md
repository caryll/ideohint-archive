# ideohint archive

This is the archive for IDEOHINT. It will be discontinued and become a hint model for [Chlorophytum](https://github.com/chlorophytum/Chlorophytum) using all-on-the-fly logics.

------

# ideohint

Optimized hinter for ideographs, built on Node.js and [otfcc](https://github.com/caryll/otfcc).

**NOTE: sfdhanautohint is now deprecated.**

## Overview

Ideographs used in Chinese, Japanese, and Korean often contain many strokes which are difficult to render distinctly at small sizes. Simply aligning horizontal and vertical strokes to the pixel grid (e.g., by rounding each stroke to the nearest grid point) is not sufficient to produce a clear image and can often lead to disastrous results (upper row). The *sfdhanautohint* generates optimized grid fitting instructions which performs character simplification when needed, to ensure that each character remains clear and legible, even at small sizes (lower row).

The core hinting strategy is to minimize a number called "readability potential" which measures the readability loss of readability caused by gridfitting, including stem collisions and stem merges. The minimization is achieved via a genetic algorithm.

## Installation

```bash
npm install ideohint -g
```

## Usage

`ideohint` takes OpenType dumps generated from [`otfccdump`](https://github.com/caryll/otfcc) as its input.

There are four major sub-commands: `otd2hgl`, `extract`, `hint`, and `apply`. To prepare your input file, use [`otfccdump`](https://github.com/caryll/otfcc) to dump the TTF you want to hint.

``` bash
# Prepare OTD:
otfccdump input.ttf -o input.otd
# Hint your font:
ideohint otd2hgl  input.otd -o glyphlist.hgl [--ideo-only | --all]
ideohint hint     <features.hgl> -o <decisions.hgi> [<strategy parameters>]
ideohint instruct <decisions.hgi> -o <instructs.hgs> [<strategy parameters>]
ideohint apply    <instructs.hgs> <input.otd> -o <output.otd> [<strategy parameters>]
# Building TTF:
otfccbuild output.otd -o output.ttf
```

### `otd2hgl`

`otd2hgl` converts OTFCC’s dump into an internal format called “hgl”. The command is:

```bash
ideohint otd2hgl input.otd -o output.hgl [--ideo-only]
```

When `--ideo-only` is present, only ideographs in the input font (identified via `cmap` table) will be preserved and hinted.

### `hint`, `instruct` and `apply`

These three sub-commands do the main hinting part:

- `hint` will generate "Hinting Decisions" using the HGL files.

- `instruct` would turn hinting decisions into instructions.

- `apply` will apply the instructions into your font.

All three sub-commands accept **strategy parameters** and **CVT padding**, which are important in the hinting process.

#### Strategy Parameters

The strategy parameters determines how `ideohint` generate the instructions. It is stored in a TOML file, and be specified using `--parameters param.toml` when calling the command. An example may be:

```toml
[hinting]
PPEM_MIN = 11
PPEM_MAX = 36
PPEM_LOCK_BOTTOM = 20
CANONICAL_STEM_WIDTH = [[11,67],[36,67]]
CANONICAL_STEM_WIDTH_DENSE = [[11,67],[36,67]]
ABSORPTION_LIMIT = 120
STEM_SIDE_MIN_RISE = 36
STEM_SIDE_MIN_DESCENT = 53
STEM_CENTER_MIN_RISE = 36
STEM_CENTER_MIN_DESCENT = 50
STEM_SIDE_MIN_DIST_RISE = 75
STEM_SIDE_MIN_DIST_DESCENT = 75
Y_FUZZ = 8
BLUEZONE_BOTTOM_CENTER = -75
BLUEZONE_BOTTOM_LIMIT = -45
BLUEZONE_TOP_CENTER = 840
BLUEZONE_TOP_LIMIT = 813
RISE = [[11,10],[18,10],[36,-1]]
SINK = [[11,5],[32,0]]
SINK_DIAGL = [[11,16],[36,15]]
GRAVITY = [[11,0],[36,0]]
CONCENTRATE = [[11,0],[36,0]]
CHEBYSHEV_4 = [[11,0],[36,0]]
CHEBYSHEV_5 = [[11,0],[36,0]]
TOP_CUT = [[11,0],[18,0],[19,1],[32,1],[33,2],[36,2]]
BOTTOM_CUT = [[11,0],[36,0]]
```

The hinting parameters are stored in `hinting` section. They include:

* **Metric Parameters**

  * **UPM** : The units-per-em value of your sfd
* **Hinting Ranges**
  * **PPEM_MIN**: Minimal size being hinted.
  * **PPEM_MAX**: Maximal size being hinted.
* **Blue zones**

  * **BLUEZONE_TOP_CENTER** and **BLUEZONE_TOP_LIMIT** : Center and lower limit of the top blue zone. Use characters like “木” to decide the value of **BLUEZONE_TOP_CENTER**.
  * **BLUEZONE_BOTTOM_CENTER** and **BLUEZONE_BOTTOM_LIMIT** : Center and lower limit of the top blue zone. Use characters like “木” to decide the value.
* **Stem Width Parameters**
    - **CANONICAL_STEM_WIDTH** : The “Canonical” stroke width among the entire font. Measured in a loose character like “里”. This parameter can be either a constant number, or a size-dependent value, in the same format of a list of PPEM-value pairs (see example above).
    - **CANONICAL_STEM_WIDTH_DENSE**: The “Canonical” stroke width of dense characters like “襄”. Useful in bold weights. Can be either a constant number, or a size-dependent value. For lighter width, it should be identical to **CANONICAL_STEM_WIDTH**. 
* **Stem Restriction Parameters**
  * **TOP_CUT**: Required space for topmost, flat stems, like the topmost stroke in “里”, to the glyph top. In pixels.
  * **BOTTOM_CUT**: Required space for bottommost, flat stems, like the bottommost stroke in “里”, to the glyph bottom. In pixels.
  * **TOP_CUT_DIAGH**: Required space for topmost, semi-diagonal stems, like the topmost stroke in “看”, to the glyph top. In pixels.
  * **BOTTOM_CUT_DIAGL**: Required space for bottommost, semi-diagonal stems to the glyph bottom. In pixels.
  * **TOP_CUT_DIAGH_DIST**: Additional space for the lower half of the topmost, semi-diagonal stems to the glyph top. In pixels.
  * **BOTTOM_CUT_DIAGL_DIST**: Additional space for the higher half of bottommost, semi-diagonal stems to the glyph bottom. In pixels.
  * **BOTTOM_UNIFY_FORCE**: Force to additionally unify bottommost features of a character. 100 by default.
  * **BOTTOM_UNIFY_FORCE_DIAG**: Force to additionally unify bottommost features of a character, applied to diagonal strokes.
  * **TOP_UNIFY_FORCE**: Force to additionally unify topmost features of a character. 50 by default.
  * **TOP_UNIFY_FORCE_DIAG**: Force to additionally unify topmost features of a character, applied to diagonal strokes.
* **Stem Positioning Parameters**
    * **RISE** : Tend to rise topmost stems. 0 for “natural”.
    * **SINK**: Tend to sink bottommost stems. 0 for “natural”.
    * **RISE_DIAGH**: Additional rise tend for the higher half of a semi-diagonal stem.
    * **SINK_DIAGL**: Additional sink tend for the lower half of a semi-diagonal stem.
    * **GRAVITY**: Tend to move middle stems upward or downward. 0 for “natural”, positive for upward, negative for downward.
    * **CONCENTRATE**: Tend to aggregate middle stems or distribute them to the character's top and bottom. Positive for aggregation, negative for distribution.
    * **CHEBYSHEV_4** and **CHEBYSHEV_5**: Fine tuning of stem distribution.
* **Stem Detection Parameters**

    * **ABSORPTION_LIMIT**: The limit when a horizontal extremum being linked to a point aligned to the top or bottom blue zone. Useful when preserving diagonal strokes’ width. Preferred value: slightly larger than **MAX_STEM_WIDTH**.
    * **STEM_SIDE_MIN_RISE** : The maximum height of decorative shapes placed aside a hotizontal stem's upper edge.
    * **STEM_SIDE_MIN_DESCENT** : The maximum depth of close decorative shapes placed aside a horizontal stem's lower edge.
    * **STEM_CENTER_MIN_RISE** : The maximum height of close decorative shapes placed above a horizontal stem's upper edge.
    * **STEM_CENTER_MIN_DESCENT** : The maximum depth of decorative shapes placed below a hotizontal stem's lower edge.
    * **STEM_SIDE_MIN_DIST_RISE** : The maximum height of distanced decorative shapes placed aside a hotizontal stem's upper edge.
    * **STEM_SIDE_MIN_DIST_DESCENT** : The maximum depth of distanced decorative shapes placed aside a hotizontal stem's lower edge.
* **Intensity Control Parameters** (VTT target only)
    * **MINIMAL_STROKE_WIDTH_PIXELS** : The minimal stroke width of strokes being wide as **CANONICAL_STEM_WIDTH**. 5/8 pixels by default.
    * **MAX_SW_OVERFLOW_CPXS** : The maximal overflow of stroke widths on their soft edge when its original width is wider than its hinted integral width. 1/2 pixels (amount 50) by default.
    * **MAX_SW_SHRINK_CPXS** : The maximal shrink of stroke widths on their soft edge when its original width is narrower than its hinted integral width. 1/2 pixels (amount 50) by default.

#### CVT padding

When building a composite font with both ideographs and letters, you may use other tools (like `ttfautohint`) to generate hints for non-ideographic characters. To avoid conflict of `cvt ` table, a number called **cvt padding** should be used. This value should be larger than the length of the `cvt ` table generated by the hinter for non-ideographs. To specify, you can either:

- set the `padding` value in parameter file’s `cvt` section, or
- pass a command-line parameter `--CVT_PADDING` when calling `ideohint hint` and `ideohint apply`.

An example workflow of hinting a complete font may be (assuming you are using `ttfautohint`):

``` bash
ttfautohint input.ttf step1.ttf
otfccdump step1.ttf -o step2.otd
ideohint otd2hgl  step2.otd -o step3.hgl --ideo-only
ideohint hint     step3.hgl -o step4.hgi --parameters params.toml
ideohint instruct step4.hgi -o step5.hgs --parameters params.toml
ideohint apply    step5.hgs step2.otd -o output.otd --parameters params.toml
otfccbuild output.otd -o output.ttf
```

### Parallism

Since `extract` and `hint` may take a lot of time, we have a few extra parameters to help you out:

* `-d` - blocks of work to divide into.
* `-m` - which block of work to process.

You can use these parameters to slice the input into multiple parallel tasks, and produce multiple outputs. To merge the outputs, use `ideohint merge`, which works for `hgl`, `hgi` and `hgs` files.

An example:

``` bash
ideohint hint -d 10 -m 0 large.hgl -o part0.hgi <parameters>
ideohint hint -d 10 -m 1 large.hgl -o part1.hgi <parameters>
......
ideohint hint -d 10 -m 9 large.hgl -o part2.hgi <parameters>
ideohint merge -o large.hgi part0.hgi part1.hgi ... part9.hgi
```

With the help with [GNU Parallel](https://gnu.org/s/parallel/) or `make`, it will provide a significant performance boost.

### Interactive Parameter Adjustment

For strategy parameters, you can adjust them using the `visual` sub-command:

``` bash
ideohint visual hans.hgl -w "<test characters>" [<parameters>]
```

It will provide an interactive parameter adjustment utility accessible from `localhost:9527`.

### Visual TrueType interface

`ideohint apply` would detect whether the input font has Visual TrueType private tables. Once it is present `ideohint apply` would also produce VTT Talks into it. You may need to compile the entire font after building using VTT.

The obsolete `ideohint vtt` command has been removed.
