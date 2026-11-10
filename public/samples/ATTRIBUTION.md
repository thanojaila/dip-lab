# Image credits and licences

All files in this folder may be redistributed. None come from EDS 6364 course materials.
Show these credits on the app attribution page (id, credit, licence).

| File | Size | Licence | Credit |
|---|---|---|---|
| cameraman.png | 512x512 gray | CC0 | Lav Varshney, via scikit-image (data.camera) |
| coins.png | 384x303 gray | No known copyright restrictions | Brooklyn Museum Collection, via scikit-image (data.coins) |
| text.png | 448x172 gray | Public domain | Wikipedia "Corner.png", via scikit-image (data.text) |
| cat.jpg | 451x300 rgb | CC0 | Stefan van der Walt, via scikit-image (data.chelsea) |
| coffee.jpg | 600x400 rgb | CC0 | Rachel Michetti, via scikit-image (data.coffee) |
| rocket.jpg | 640x427 rgb | Public domain | SpaceX, via scikit-image (data.rocket) |
| hubble.jpg | 1000x872 rgb | Public domain (NASA) | NASA / ESA Hubble eXtreme Deep Field, via scikit-image (data.hubble_deep_field) |
| retina.jpg | 1024x1024 rgb | CC0 | Mikael Haggstrom, via scikit-image (data.retina) |
| brick.png | 512x512 gray | CC0 | CC0Textures "Bricks25", via scikit-image (data.brick) |
| gravel.png | 512x512 gray | CC0 | CC0Textures "Gravel04", via scikit-image (data.gravel) |
| grass.png | 512x512 gray | CC0 | Linolafett, via scikit-image (data.grass) |
| horse.png | 400x328 gray | CC0 | Andreas Preuss (marauder), openclipart, via scikit-image (data.horse) |
| clock_motion.png | 400x300 gray | Public domain | Stefan van der Walt, via scikit-image (data.clock) |
| tissue_ihc.jpg | 512x512 rgb | No known copyright restrictions | Center for Microscopy And Molecular Imaging (CMMI), via scikit-image (data.immunohistochemistry) |
| cell.png | 550x660 gray | CC0 | Paul Muller et al., via scikit-image (data.cell) |
| microaneurysms.png | 102x102 gray | CC0 | Andreas Maier, via scikit-image (data.microaneurysms) |
| sudoku.png | 558x563 rgb | Apache-2.0 (OpenCV sample) | OpenCV samples/data/sudoku.png |
| building.jpg | 868x600 rgb | Apache-2.0 (OpenCV sample) | OpenCV samples/data/building.jpg |
| smarties.png | 413x356 rgb | Apache-2.0 (OpenCV sample) | OpenCV samples/data/smarties.png |
| blocks.png | 256x256 rgb | Apache-2.0 (OpenCV sample) | OpenCV samples/data/blox.jpg |
| shapes.png | 400x300 rgb | Apache-2.0 (OpenCV sample) | OpenCV samples/data/pic1.png |
| sheet_music.png | 1024x134 rgb | Apache-2.0 (OpenCV sample) | OpenCV samples/data/notes.png |
| cards.png | 640x480 rgb | Apache-2.0 (OpenCV sample) | OpenCV samples/data/cards.png |
| circuit_board.jpg | 640x480 rgb | Apache-2.0 (OpenCV sample) | OpenCV samples/data/board.jpg |

## Notes
- scikit-image rows: licence text is taken from the `skimage.data` function docstrings in scikit-image 0.26.0.
- OpenCV rows: the files ship in the OpenCV repository (Apache-2.0). OpenCV does not record the original photographer for each sample, so treat these as "OpenCV sample data" and keep the credit line. If you want a strictly documented set, drop these 8 and use the fallbacks listed in the handoff.
- `retina.jpg` was downscaled from 1411x1411 to 1024x1024 (INTER_AREA). `blocks.png` was re-encoded from blox.jpg. Colour photos are JPEG quality 92; everything else is lossless PNG.
- Deliberately left out: scikit-image `moon` and `page` (no licence stated), `astronaut` (portrait of a named person), and Lena.
