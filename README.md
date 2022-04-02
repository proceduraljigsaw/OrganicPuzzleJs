# OrganicPuzzleJs

This is a (pretty broken, but mostly functional) organic-shaped jigsaw generator with custom border support.
It relies on two linbraries from third parties, imagetracerjs and flatten (see respective files).
Use online at https://proceduraljigsaw.github.io/OrganicPuzzleJs/

## What is this

This tries to generate organic-shaped random jigsaws. I tried to emulate some puzzles I saw online, which I thought were generated using a cellular automata, and I arrived at this algorithm, which I have no idea why it works but produces cool looking piece shapes which I haven't seen before in other jigsaws.

The generation starts with a canvas, where seed cells are planted in a noisy rectangular grid. These cells start growing (conquering neighbor unoccupied sites) until the whole canvas is filled. Each expansion cycle each cell conquers all its available empty sites. The result of this behavior, if done properly, would be "cell" patches disposed in a Voronoi pattern. I accidentally (lol) found that if I break the algorithm so that instead of a true Voronoi pattern some buggy version of it appears, then the resulting puzzles are more varied and I like them better, so buggy Voronoi it is.

After the seed cells have established their initial colonies, they start eating and conquering eachother. There's an algorithm that makes the colonies grow with "dentrite" patterns. This algorithm relies on counting the numnber of same colored neighbors of a cell you want to eat, and the number of same colored neighbors of each neighbor of this neighnbor, with repetition. If the ratio between this two numbers exceeds 6.2, the cell is OK to eat. Why 6.2? No idea. I could give you an explanation of my though process and how I arrived at this, but it would be mostly nonsense and stuff pulled out of the lazy part of my brain. Does it work with this parameter set to other values? Try for yourself and see. Nothing should break...

This algorithm leads to quite a bit of spurious growth which I try to clean up, but sometimes it fails... please cut the puzzles first in some cheap material before committing to a design...

A vectorizing algorithm fits splines along the piece borders to generate a cuttable SVG.

You can grow the jigsaw manually until you're satisfied and download the result for lasercutting or whatever.

Use with caution!

PS. Nothing is uploaded anywhere, your SVG border stays in your computer!

# How to use

1. Adjust the desired generation parameters:

   * Columns and rows: in rectangular (default) jigsaw mode, these define the number of rows and columns for the piece grid
   * Grid size: regular square grid size for seeding. Seeds are planted in regular intervals every grid size cells, with some added randomness.
   * Initial grid possition noise: how much noise will be added to each seed position. Setting this parameter to 0 will place the seeds in a regular square grid.
   * Growth radius: cells will only expand up to this radius away from the seed cell. It should be set to at least 2x grid size.
   * Curve fitting threshold: higher value = the vectorizer uses more straight line segments. Lower value: less straight line segments, more jittery curves.
   * Magic number: just leave this at 6.2 ok?
   * Growth probability: each cell will grow with this probability each cycle.
   * Cell size: how a cell translates to the physical world. Each cell represents an area of size x size mm. Set to at least 2mm, better if 3 or more, so that choke points don't create too weak pieces.
   * Preview viewing scale: size of each cell in pixels for the colored preview thing.
   * Custom border scale factor: when using a custom border, this scale will be applied to the border SVG. The puzzle size will be border size x scale.
2. Want to use a custom SVG border? Use the file picker and then press Load SVG customborder.
3. Press Generate Jigsaw and wait
4. Press Grow as many times as you want until you're satisfied
5. Download SVG, check and cut.

## Limitations

This is seriously broken. I don't know why it works, and the code quality is abysmal (except for the 2 third party libraries I use which are awesome). I only release it because I don't have time to improve it much more and it more often than not produces quite nice output.

Some parameters can be adjusted between growth cycles and won't break the generator, others will break. If you load a custom border and press generate button and don't like how the jigsaw is going, you have to reload the border again before pressing generate again, or else it will break.

It's slow and not optimized, so be patient with it and expect several seconds of processing time per growth step.
