/*
	imagetracer.js version 1.2.6
	Simple raster image tracer and vectorizer written in JavaScript.
	andras@jankovics.net
    This is not the original imagetracer.js library, it has been modified
    by proceduraljigsaw for this specific project.
*/

/*
The Unlicense / PUBLIC DOMAIN
This is free and unencumbered software released into the public domain.
Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.
In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
For more information, please refer to http://unlicense.org/
*/

(function () {
    'use strict';

    function ImageTracer() {
        var _this = this;

        this.versionnumber = '1.2.6custom',

            ////////////////////////////////////////////////////////////
            //
            //  API
            //
            ////////////////////////////////////////////////////////////

            this.pathsToSVG = function (paths, border, cornertable, width, height, options) {
                options = _this.checkoptions(options);
                // tracing imagedata
                var td = _this.pathsToTracedata(paths, cornertable, width, height, options);
                // returning SVG string
                return _this.getsvgstringstrokes(td, border, options);
            },// End of 


            this.pathsToTracedata = function (paths, cornertable, width, height, options) {
                options = _this.checkoptions(options);
                // create tracedata object
                var tracedata = {
                    layers: [],
                    palette: null,
                    width: width,
                    height: height
                };
                paths.forEach((p) => {
                    var tracedlayer =
                        _this.batchtracepaths(

                            _this.internodesopen(

                                [p],
                                cornertable,
                                options

                            ),

                            options.ltres,
                            options.qtres

                        );

                    // adding traced layer
                    tracedata.layers.push(tracedlayer);
                });
                // return tracedata
                return tracedata;

            }
        // Tracing imagedata, then returning tracedata (layers with paths, palette, image size)
        this.imagedataToTracedata = function (imgd, options) {
            options = _this.checkoptions(options);

            // 1. Color quantization
            var ii = _this.colorquantization(imgd, options);

            if (options.layering === 0) {// Sequential layering

                // create tracedata object
                var tracedata = {
                    layers: [],
                    palette: ii.palette,
                    width: ii.array[0].length - 2,
                    height: ii.array.length - 2
                };

                // Loop to trace each color layer
                for (var colornum = 0; colornum < ii.palette.length; colornum++) {

                    // layeringstep -> pathscan -> internodes -> batchtracepaths
                    var tracedlayer =
                        _this.batchtracepaths(

                            _this.internodes(

                                _this.pathscan(
                                    _this.layeringstep(ii, colornum),
                                    options.pathomit
                                ),

                                options

                            ),

                            options.ltres,
                            options.qtres

                        );

                    // adding traced layer
                    tracedata.layers.push(tracedlayer);

                }// End of color loop

            } else {// Parallel layering
                // 2. Layer separation and edge detection
                var ls = _this.layering(ii);

                // Optional edge node visualization
                if (options.layercontainerid) { _this.drawLayers(ls, _this.specpalette, options.scale, options.layercontainerid); }

                // 3. Batch pathscan
                var bps = _this.batchpathscan(ls, options.pathomit);

                // 4. Batch interpollation
                var bis = _this.batchinternodes(bps, options);

                // 5. Batch tracing and creating tracedata object
                var tracedata = {
                    layers: _this.batchtracelayers(bis, options.ltres, options.qtres),
                    palette: ii.palette,
                    width: imgd.width,
                    height: imgd.height
                };

            }// End of parallel layering

            // return tracedata
            return tracedata;

        },// End of imagedataToTracedata()

            this.optionpresets = {
                'default': {
                    // Tracing
                    corsenabled: false,
                    ltres: 1,
                    qtres: 1,
                    pathomit: 8,
                    rightangleenhance: true,


                    // Layering method
                    layering: 0,

                    // SVG rendering
                    strokewidth: 1,
                    linefilter: false,
                    scale: 1,
                    roundcoords: 1,
                    viewbox: false,
                    desc: false,
                    lcpr: 0,
                    qcpr: 0,

                }
            },// End of optionpresets

            // creating options object, setting defaults for missing values
            this.checkoptions = function (options) {
                options = options || {};
                // Option preset
                if (typeof options === 'string') {
                    options = options.toLowerCase();
                    if (_this.optionpresets[options]) { options = _this.optionpresets[options]; } else { options = {}; }
                }
                // Defaults
                var ok = Object.keys(_this.optionpresets['default']);
                for (var k = 0; k < ok.length; k++) {
                    if (!options.hasOwnProperty(ok[k])) { options[ok[k]] = _this.optionpresets['default'][ok[k]]; }
                }
                // options.pal is not defined here, the custom palette should be added externally: options.pal = [ { 'r':0, 'g':0, 'b':0, 'a':255 }, {...}, ... ];
                // options.layercontainerid is not defined here, can be added externally: options.layercontainerid = 'mydiv'; ... <div id="mydiv"></div>
                return options;
            },// End of checkoptions()


            // Generating a palette with numberofcolors
            this.generatepalette = function (numberofcolors) {
                var palette = [], rcnt, gcnt, bcnt;
                if (numberofcolors < 8) {

                    // Grayscale
                    var graystep = Math.floor(255 / (numberofcolors - 1));
                    for (var i = 0; i < numberofcolors; i++) { palette.push({ r: i * graystep, g: i * graystep, b: i * graystep, a: 255 }); }

                } else {

                    // RGB color cube
                    var colorqnum = Math.floor(Math.pow(numberofcolors, 1 / 3)), // Number of points on each edge on the RGB color cube
                        colorstep = Math.floor(255 / (colorqnum - 1)), // distance between points
                        rndnum = numberofcolors - colorqnum * colorqnum * colorqnum; // number of random colors

                    for (rcnt = 0; rcnt < colorqnum; rcnt++) {
                        for (gcnt = 0; gcnt < colorqnum; gcnt++) {
                            for (bcnt = 0; bcnt < colorqnum; bcnt++) {
                                palette.push({ r: rcnt * colorstep, g: gcnt * colorstep, b: bcnt * colorstep, a: 255 });
                            }// End of blue loop
                        }// End of green loop
                    }// End of red loop

                    // Rest is random
                    for (rcnt = 0; rcnt < rndnum; rcnt++) { palette.push({ r: Math.floor(Math.random() * 255), g: Math.floor(Math.random() * 255), b: Math.floor(Math.random() * 255), a: Math.floor(Math.random() * 255) }); }

                }// End of numberofcolors check

                return palette;
            },// End of generatepalette()



            this.internodesopen = function (paths, cornertable, options) {
                var ins = [], palen = 0, nextidx = 0, nextidx2 = 0, previdx = 0, previdx2 = 0, pacnt, pcnt;
                var lastls;
                // paths loop
                var p1fit = cornertable.filter(c => c.col == paths[0].points[0].x && c.row == paths[0].points[0].y);
                if (p1fit.length) {
                    paths[0].points[0].x = p1fit[0].x;
                    paths[0].points[0].y = p1fit[0].y;
                }
                var p2fit = cornertable.filter(c => c.col == paths[0].points[paths[0].points.length - 1].x && c.row == paths[0].points[paths[0].points.length - 1].y);
                if (p2fit.length) {
                    paths[0].points[paths[0].points.length - 1].x = p2fit[0].x;
                    paths[0].points[paths[0].points.length - 1].y = p2fit[0].y;
                }

                for (pacnt = 0; pacnt < paths.length; pacnt++) {

                    ins[pacnt] = {};
                    ins[pacnt].points = [];
                    ins[pacnt].boundingbox = paths[pacnt].boundingbox;
                    ins[pacnt].holechildren = paths[pacnt].holechildren;
                    ins[pacnt].isholepath = paths[pacnt].isholepath;
                    palen = paths[pacnt].points.length;

                    ins[pacnt].points.push({
                        x: (paths[pacnt].points[0].x),
                        y: (paths[pacnt].points[0].y),
                        linesegment: _this.getdirection(
                            (paths[pacnt].points[0].x),
                            (paths[pacnt].points[0].y),
                            (paths[pacnt].points[1].x),
                            (paths[pacnt].points[1].y)
                        )
                    });
                    lastls = _this.getdirection(
                        (paths[pacnt].points[0].x),
                        (paths[pacnt].points[0].y),
                        (paths[pacnt].points[1].x),
                        (paths[pacnt].points[1].y)
                    );
                    // pathpoints loop
                    for (pcnt = 1; pcnt < palen - 2; pcnt++) {

                        // next and previous point indexes
                        nextidx = (pcnt + 1) % palen; nextidx2 = (pcnt + 2) % palen;
                        lastls = _this.getdirection(
                            ((paths[pacnt].points[pcnt].x + paths[pacnt].points[nextidx].x) / 2),
                            ((paths[pacnt].points[pcnt].y + paths[pacnt].points[nextidx].y) / 2),
                            ((paths[pacnt].points[nextidx].x + paths[pacnt].points[nextidx2].x) / 2),
                            ((paths[pacnt].points[nextidx].y + paths[pacnt].points[nextidx2].y) / 2)
                        );

                        // interpolate between two path points
                        ins[pacnt].points.push({
                            x: ((paths[pacnt].points[pcnt].x + paths[pacnt].points[nextidx].x) / 2),
                            y: ((paths[pacnt].points[pcnt].y + paths[pacnt].points[nextidx].y) / 2),
                            linesegment: lastls
                        });

                    }// End of pathpoints loop

                    ins[pacnt].points.push({
                        x: (paths[pacnt].points[palen - 1].x),
                        y: (paths[pacnt].points[palen - 1].y),
                        linesegment: lastls
                    });
                }// End of paths loop

                return ins;
            },// End of internodes()


            this.getdirection = function (x1, y1, x2, y2) {
                var val = 8;
                if (x1 < x2) {
                    if (y1 < y2) { val = 1; }// SouthEast
                    else if (y1 > y2) { val = 7; }// NE
                    else { val = 0; }// E
                } else if (x1 > x2) {
                    if (y1 < y2) { val = 3; }// SW
                    else if (y1 > y2) { val = 5; }// NW
                    else { val = 4; }// W
                } else {
                    if (y1 < y2) { val = 2; }// S
                    else if (y1 > y2) { val = 6; }// N
                    else { val = 8; }// center, this should not happen
                }
                return val;
            },// End of getdirection()


            // 5. tracepath() : recursively trying to fit straight and quadratic spline segments on the 8 direction internode path

            // 5.1. Find sequences of points with only 2 segment types
            // 5.2. Fit a straight line on the sequence
            // 5.3. If the straight line fails (distance error > ltres), find the point with the biggest error
            // 5.4. Fit a quadratic spline through errorpoint (project this to get controlpoint), then measure errors on every point in the sequence
            // 5.5. If the spline fails (distance error > qtres), find the point with the biggest error, set splitpoint = fitting point
            // 5.6. Split sequence and recursively apply 5.2. - 5.6. to startpoint-splitpoint and splitpoint-endpoint sequences

            this.tracepath = function (path, ltres, qtres) {
                var pcnt = 0, segtype1, segtype2, seqend, smp = {};
                smp.segments = [];
                smp.boundingbox = path.boundingbox;
                smp.holechildren = path.holechildren;
                smp.isholepath = path.isholepath;

                while (pcnt < path.points.length - 1) {
                    // 5.1. Find sequences of points with only 2 segment types
                    segtype1 = path.points[pcnt].linesegment; segtype2 = -1; seqend = pcnt + 1;
                    while (
                        ((path.points[seqend].linesegment === segtype1) || (path.points[seqend].linesegment === segtype2) || (segtype2 === -1))
                        && (seqend < path.points.length - 1)) {

                        if ((path.points[seqend].linesegment !== segtype1) && (segtype2 === -1)) { segtype2 = path.points[seqend].linesegment; }
                        seqend++;

                    }
                    //if (seqend === path.points.length - 1) { seqend = 0; }

                    // 5.2. - 5.6. Split sequence and recursively apply 5.2. - 5.6. to startpoint-splitpoint and splitpoint-endpoint sequences
                    smp.segments = smp.segments.concat(_this.fitseq(path, ltres, qtres, pcnt, seqend));

                    // forward pcnt;
                    if (seqend > 0) { pcnt = seqend; } else { pcnt = path.points.length; }

                }// End of pcnt loop

                return smp;
            },// End of tracepath()

            // 5.2. - 5.6. recursively fitting a straight or quadratic line segment on this sequence of path nodes,
            // called from tracepath()
            this.fitseq = function (path, ltres, qtres, seqstart, seqend) {
                // return if invalid seqend
                if ((seqend > path.points.length) || (seqend < 0)) {
                    console.log("I has fail");
                    return [];
                }
                // variables
                var errorpoint = seqstart, errorval = 0, curvepass = true, px, py, dist2;
                var tl = (seqend - seqstart); if (tl < 0) { tl += path.points.length; }
                var vx = (path.points[seqend].x - path.points[seqstart].x) / tl,
                    vy = (path.points[seqend].y - path.points[seqstart].y) / tl;

                // 5.2. Fit a straight line on the sequence
                var pcnt = (seqstart + 1) % path.points.length, pl;
                while (pcnt != seqend) {
                    pl = pcnt - seqstart; if (pl < 0) { pl += path.points.length; }
                    px = path.points[seqstart].x + vx * pl; py = path.points[seqstart].y + vy * pl;
                    dist2 = (path.points[pcnt].x - px) * (path.points[pcnt].x - px) + (path.points[pcnt].y - py) * (path.points[pcnt].y - py);
                    if (dist2 > ltres) { curvepass = false; }
                    if (dist2 > errorval) { errorpoint = pcnt; errorval = dist2; }
                    pcnt = (pcnt + 1) % path.points.length;
                }
                // return straight line if fits
                if (curvepass) {
                    if (seqend) {
                        return [{ type: 'L', x1: path.points[seqstart].x, y1: path.points[seqstart].y, x2: path.points[seqend].x, y2: path.points[seqend].y }];
                    } else {
                        seqend = path.points.length - 1;
                        return [{ type: 'L', x1: path.points[seqstart].x, y1: path.points[seqstart].y, x2: path.points[seqend].x, y2: path.points[seqend].y }];
                    }
                }

                // 5.3. If the straight line fails (distance error>ltres), find the point with the biggest error
                var fitpoint = errorpoint; curvepass = true; errorval = 0;

                // 5.4. Fit a quadratic spline through this point, measure errors on every point in the sequence
                // helpers and projecting to get control point
                var t = (fitpoint - seqstart) / tl, t1 = (1 - t) * (1 - t), t2 = 2 * (1 - t) * t, t3 = t * t;
                var cpx = (t1 * path.points[seqstart].x + t3 * path.points[seqend].x - path.points[fitpoint].x) / -t2,
                    cpy = (t1 * path.points[seqstart].y + t3 * path.points[seqend].y - path.points[fitpoint].y) / -t2;

                // Check every point
                pcnt = seqstart + 1;
                while (pcnt != seqend) {
                    t = (pcnt - seqstart) / tl; t1 = (1 - t) * (1 - t); t2 = 2 * (1 - t) * t; t3 = t * t;
                    px = t1 * path.points[seqstart].x + t2 * cpx + t3 * path.points[seqend].x;
                    py = t1 * path.points[seqstart].y + t2 * cpy + t3 * path.points[seqend].y;

                    dist2 = (path.points[pcnt].x - px) * (path.points[pcnt].x - px) + (path.points[pcnt].y - py) * (path.points[pcnt].y - py);

                    if (dist2 > qtres) { curvepass = false; }
                    if (dist2 > errorval) { errorpoint = pcnt; errorval = dist2; }
                    pcnt = (pcnt + 1) % path.points.length;
                }
                // return spline if fits
                if (curvepass) { return [{ type: 'Q', x1: path.points[seqstart].x, y1: path.points[seqstart].y, x2: cpx, y2: cpy, x3: path.points[seqend].x, y3: path.points[seqend].y }]; }
                // 5.5. If the spline fails (distance error>qtres), find the point with the biggest error
                var splitpoint = fitpoint; // Earlier: Math.floor((fitpoint + errorpoint)/2);

                // 5.6. Split sequence and recursively apply 5.2. - 5.6. to startpoint-splitpoint and splitpoint-endpoint sequences
                return _this.fitseq(path, ltres, qtres, seqstart, splitpoint).concat(
                    _this.fitseq(path, ltres, qtres, splitpoint, seqend));

            },// End of fitseq()

            // 5. Batch tracing paths
            this.batchtracepaths = function (internodepaths, ltres, qtres) {
                var btracedpaths = [];
                for (var k in internodepaths) {
                    if (!internodepaths.hasOwnProperty(k)) { continue; }
                    btracedpaths.push(_this.tracepath(internodepaths[k], ltres, qtres));
                }
                return btracedpaths;
            },

            ////////////////////////////////////////////////////////////
            //
            //  SVG Drawing functions
            //
            ////////////////////////////////////////////////////////////

            // Rounding to given decimals https://stackoverflow.com/questions/11832914/round-to-at-most-2-decimal-places-in-javascript
            this.roundtodec = function (val, places) { return +val.toFixed(places); },
            this.svgpathstringuncolored = function (tracedata, lnum, pathnum, options) {

                var layer = tracedata.layers[lnum], smp = layer[pathnum], str = '', pcnt;

                // Line filter
                if (options.linefilter && (smp.segments.length < 3)) { return str; }

                // Starting path element, desc contains layer and path number
                str = '<path ' +
                    (options.desc ? ('desc="l ' + lnum + ' p ' + pathnum + '" ') : '') +
                    _this.tosvgstrokestr(options) +
                    'd="'; 1
                var pcntlim = smp.segments.length;
                // Creating non-hole path string
                if (options.roundcoords === -1) {
                    str += 'M ' + smp.segments[0].x1 * options.scale + ' ' + smp.segments[0].y1 * options.scale + ' ';
                    for (pcnt = 0; pcnt < pcntlim; pcnt++) {
                        str += smp.segments[pcnt].type + ' ' + smp.segments[pcnt].x2 * options.scale + ' ' + smp.segments[pcnt].y2 * options.scale + ' ';
                        if (smp.segments[pcnt].hasOwnProperty('x3')) {
                            str += smp.segments[pcnt].x3 * options.scale + ' ' + smp.segments[pcnt].y3 * options.scale + ' ';
                        }
                    }

                } else {
                    str += 'M ' + _this.roundtodec(smp.segments[0].x1 * options.scale, options.roundcoords) + ' ' + _this.roundtodec(smp.segments[0].y1 * options.scale, options.roundcoords) + ' ';
                    for (pcnt = 0; pcnt < pcntlim; pcnt++) {
                        str += smp.segments[pcnt].type + ' ' + _this.roundtodec(smp.segments[pcnt].x2 * options.scale, options.roundcoords) + ' ' + _this.roundtodec(smp.segments[pcnt].y2 * options.scale, options.roundcoords) + ' ';
                        if (smp.segments[pcnt].hasOwnProperty('x3')) {
                            str += _this.roundtodec(smp.segments[pcnt].x3 * options.scale, options.roundcoords) + ' ' + _this.roundtodec(smp.segments[pcnt].y3 * options.scale, options.roundcoords) + ' ';
                        }
                    }

                }// End of creating non-hole path string


                // Closing path element
                str += '" />';

                // Rendering control points
                if (options.lcpr || options.qcpr) {
                    for (pcnt = 0; pcnt < smp.segments.length; pcnt++) {
                        if (smp.segments[pcnt].hasOwnProperty('x3') && options.qcpr) {
                            str += '<circle cx="' + smp.segments[pcnt].x2 * options.scale + '" cy="' + smp.segments[pcnt].y2 * options.scale + '" r="' + options.qcpr + '" fill="cyan" stroke-width="' + options.qcpr * 0.2 + '" stroke="black" />';
                            str += '<circle cx="' + smp.segments[pcnt].x3 * options.scale + '" cy="' + smp.segments[pcnt].y3 * options.scale + '" r="' + options.qcpr + '" fill="white" stroke-width="' + options.qcpr * 0.2 + '" stroke="black" />';
                            str += '<line x1="' + smp.segments[pcnt].x1 * options.scale + '" y1="' + smp.segments[pcnt].y1 * options.scale + '" x2="' + smp.segments[pcnt].x2 * options.scale + '" y2="' + smp.segments[pcnt].y2 * options.scale + '" stroke-width="' + options.qcpr * 0.2 + '" stroke="cyan" />';
                            str += '<line x1="' + smp.segments[pcnt].x2 * options.scale + '" y1="' + smp.segments[pcnt].y2 * options.scale + '" x2="' + smp.segments[pcnt].x3 * options.scale + '" y2="' + smp.segments[pcnt].y3 * options.scale + '" stroke-width="' + options.qcpr * 0.2 + '" stroke="cyan" />';
                        }
                        if ((!smp.segments[pcnt].hasOwnProperty('x3')) && options.lcpr) {
                            str += '<circle cx="' + smp.segments[pcnt].x2 * options.scale + '" cy="' + smp.segments[pcnt].y2 * options.scale + '" r="' + options.lcpr + '" fill="white" stroke-width="' + options.lcpr * 0.2 + '" stroke="black" />';
                        }
                    }

                    // Hole children control points
                    for (var hcnt = 0; hcnt < smp.holechildren.length; hcnt++) {
                        var hsmp = layer[smp.holechildren[hcnt]];
                        for (pcnt = 0; pcnt < hsmp.segments.length; pcnt++) {
                            if (hsmp.segments[pcnt].hasOwnProperty('x3') && options.qcpr) {
                                str += '<circle cx="' + hsmp.segments[pcnt].x2 * options.scale + '" cy="' + hsmp.segments[pcnt].y2 * options.scale + '" r="' + options.qcpr + '" fill="cyan" stroke-width="' + options.qcpr * 0.2 + '" stroke="black" />';
                                str += '<circle cx="' + hsmp.segments[pcnt].x3 * options.scale + '" cy="' + hsmp.segments[pcnt].y3 * options.scale + '" r="' + options.qcpr + '" fill="white" stroke-width="' + options.qcpr * 0.2 + '" stroke="black" />';
                                str += '<line x1="' + hsmp.segments[pcnt].x1 * options.scale + '" y1="' + hsmp.segments[pcnt].y1 * options.scale + '" x2="' + hsmp.segments[pcnt].x2 * options.scale + '" y2="' + hsmp.segments[pcnt].y2 * options.scale + '" stroke-width="' + options.qcpr * 0.2 + '" stroke="cyan" />';
                                str += '<line x1="' + hsmp.segments[pcnt].x2 * options.scale + '" y1="' + hsmp.segments[pcnt].y2 * options.scale + '" x2="' + hsmp.segments[pcnt].x3 * options.scale + '" y2="' + hsmp.segments[pcnt].y3 * options.scale + '" stroke-width="' + options.qcpr * 0.2 + '" stroke="cyan" />';
                            }
                            if ((!hsmp.segments[pcnt].hasOwnProperty('x3')) && options.lcpr) {
                                str += '<circle cx="' + hsmp.segments[pcnt].x2 * options.scale + '" cy="' + hsmp.segments[pcnt].y2 * options.scale + '" r="' + options.lcpr + '" fill="white" stroke-width="' + options.lcpr * 0.2 + '" stroke="black" />';
                            }
                        }
                    }
                }// End of Rendering control points

                return str;

            },// End of svgpathstring()

            this.getsvgstringstrokes = function (tracedata, border, options) {

                options = _this.checkoptions(options);

                var w = tracedata.width * options.scale, h = tracedata.height * options.scale;
                var svheader_display = '<svg ' + 'width="' + w + '" height="' + h + '" ';
                var svheader_save = '<svg ' +  ('viewBox="0 0 ' + w + ' ' + h + '" ') + ('width="' + w + 'mm" height="' + h + 'mm" ');
                // SVG start
                var svgstr = 'version="1.1" xmlns="http://www.w3.org/2000/svg" desc="Created with a heavily modified imagetracer.js version ' + _this.versionnumber + '" >';

                // Drawing: Layers and Paths loops
                for (var lcnt = 0; lcnt < tracedata.layers.length; lcnt++) {
                    for (var pcnt = 0; pcnt < tracedata.layers[lcnt].length; pcnt++) {

                        // Adding SVG <path> string
                        if (!tracedata.layers[lcnt][pcnt].isholepath) {
                            svgstr += _this.svgpathstringuncolored(tracedata, lcnt, pcnt, options);
                        }

                    }// End of paths loop
                }// End of layers loop

                // SVG End
                if (border.paths) {
                    for (let p of border.paths) {
                        svgstr += "<path fill=\"none\" stroke=\"black\" stroke-width=\"0.5\" d=\"";
                        svgstr += p.getAttribute("d");
                        svgstr += "\"></path>";
                     }
                }else{
                    svgstr += "\"<rect x=\"" + 0 + "\" y=\"" + 0 + "\" width=\"" + w + "\" height=\"" + h + "\" style=\"fill:none;stroke:black;stroke-width:0.5;fill-opacity:1;stroke-opacity:1\" />"
                }
                svgstr += '</svg>';

                return [svheader_display+svgstr , svheader_save+svgstr];

            },// End of getsvgstring()


            // Comparator for numeric Array.sort
            this.compareNumbers = function (a, b) { return a - b; },

            // Convert color object to rgba string
            this.torgbastr = function (c) { return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + c.a + ')'; },

            // Convert color object to SVG color string

            this.tosvgstrokestr = function (options) {
                return 'fill="none" stroke="black" stroke-width="' + options.strokewidth + '" opacity="' + 1 + '" ';
            },
            this.tosvgcolorstr = function (c, options) {
                return 'fill="rgb(' + c.r + ',' + c.g + ',' + c.b + ')" stroke="black" stroke-width="' + options.v + '" opacity="' + 1 + '" ';
            },

            // Helper function: Appending an <svg> element to a container from an svgstring
            this.appendSVGString = function (svgstr, parentid) {
                var div;
                if (parentid) {
                    div = document.getElementById(parentid);
                    if (!div) {
                        div = document.createElement('div');
                        div.id = parentid;
                        document.body.appendChild(div);
                    }
                } else {
                    div = document.createElement('div');
                    document.body.appendChild(div);
                }
                div.innerHTML += svgstr;
            };// End of function list

    }// End of ImageTracer object

    // export as AMD module / Node module / browser or worker variable
    if (typeof define === 'function' && define.amd) {
        define(function () { return new ImageTracer(); });
    } else if (typeof module !== 'undefined') {
        module.exports = new ImageTracer();
    } else if (typeof self !== 'undefined') {
        self.ImageTracer = new ImageTracer();
    } else window.ImageTracer = new ImageTracer();

})();