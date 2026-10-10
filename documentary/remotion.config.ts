import {Config} from '@remotion/cli/config';

// Frame images are encoded as JPEG for speed; switch to "png" for lossless masters.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
// Film grain + SVG filters are GPU-light but CPU-heavy. Lower if your machine struggles.
Config.setConcurrency(null);
