/*
 * @class Spline
 * @aka L.Spline
 * @inherits L.Polyline
 *
 * A class for drawing cardinal spline on map. Extends `Polyline`.
 * The algorithm description can be found in https://www.cubic.org/docs/hermite.htm
 *
 * @example
 *
 * ```js

	L.Spline([
		[30.661057, 104.081757], 
        [29.558176, 106.510338], 
        [28.200825, 112.98127],
        [30.567514, 114.291939]
	], {
        color: '#FF0000',
        weight: 2,
        opacity: 0.5,
    }).addTo(map);

 * ```
 */

L.Spline = L.Polyline.extend({

	options: {
		tension: 0.5,
		numOfSegments: 20,
		close: false
	},

	initialize: function(latlngs, options) {
		L.Polyline.prototype.initialize.call(this, latlngs, options);
		L.Util.setOptions(this, options);
	},

	_updatePath: function () {
		this._renderer._updateSpline(this);
	},

	_getSplinePoints: function (points) {
		'use strict';
		var tension  = this.options.tension;
		var numOfSeg = this.options.numOfSegments;
		var close = this.options.close;

		var pts,
			i = 1,
			l = points.length,
			rPos = 0,
			rLen = (l*2-2) * numOfSeg + 2 + (close ? 2 * numOfSeg: 0),
			res = new Float32Array(rLen),		// 准备一个存储结果的数组
			cache = new Float32Array((numOfSeg + 2) * 4),
			cachePtr = 4;
		
		// 复制一个新的数组
		pts = points.slice(0);

		if (close) {
			pts.unshift(points[l-1]);
			pts.push(points[0]);
		} else {
			// 如果不闭环,在数组前插入第一点		
			pts.unshift(points[0]);
			// 在数组最后插入最后一个点
			pts.push(points[l-1]);
		}

		// cache inner-loop calculations as they are based on t alone
		cache[0] = 1;                               // 1,0,0,0

		// 准备一个存放各个插值点处的hermite matrix参数
		for (var i=0; i < numOfSeg; i++) {
			var st   = i / numOfSeg,
				st2  = st * st,
				st3  = st2 * st,
				st23 = st3 * 2,
				st32 = st2 * 3;
			cache[cachePtr++] = st23 - st32 + 1;     // c1
			cache[cachePtr++] = st32 - st23;         // c2
			cache[cachePtr++] = st3  - st2 * 2 + st; // c3
			cache[cachePtr++] = st3  - st2;          // c4
		}

		cache[++cachePtr] = 1;                       // 0,1,0,0
		parse(pts, cache, l+2);

		if (close) {
			pts = [];
			//pts.push(points[l - 4], points[l - 3], points[l - 2], points[l - 1]); // second last and last
			pts.push(points[l - 2])
			pts.push(points[l - 1]); // second last and last

			//pts.push(points[0], points[1], points[2], points[3]); // first and second
			pts.push(points[0]);
			pts.push(points[1]);
			parse(pts, cache, 4);
		}

		function parse(pts, cache, l) {
			for (var i = 1; i < l-2; i += 1) {
				var pt1 = pts[i].x,		// p1's cooridinate
					pt2 = pts[i].y,		
					pt3 = pts[i+1].x,	// p2's cooridinate
					pt4 = pts[i+1].y,	

					// caculate point's tangent value by it's previouse and next siblings 
					t1x = (pt3 - pts[i-1].x) * tension,	// x of p1's tangents 
					t1y = (pt4 - pts[i-1].y) * tension,	// y of p1's tangents
					t2x = (pts[i+2].x - pt1) * tension,	// x of p2's tangents
					t2y = (pts[i+2].y - pt2) * tension;	// y of p2's tangents

				for (var t = 0; t < numOfSeg; t++) {
					var c = t << 2, //t * 4;
						c1 = cache[c],
						c2 = cache[c+1],
						c3 = cache[c+2],
						c4 = cache[c+3];
					res[rPos++] = c1 * pt1 + c2 * pt3 + c3 * t1x + c4 * t2x;
					res[rPos++] = c1 * pt2 + c2 * pt4 + c3 * t1y + c4 * t2y;
				}
			}
		}

		// add last point
		l = close ? 0 : points.length - 1;
		res[rPos++] = points[l].x;
		res[rPos] = points[l].y;

		return res;
	},
});

L.Canvas.prototype._updateSpline = function(layer) {
	if ( !this._drawing || layer.isEmpty() ) { return; }

	this._drawnLayers[layer._leaflet_id] = layer;

	var ctx = this._ctx;
	var len = layer._rings.length;
	var parts = [];
	for (var i=0; i<len; i++) {
		var part = layer._getSplinePoints(layer._rings[i]);
		parts.push(part);
	}

	ctx.beginPath();

	for (i = 0; i < len; i++) {
		var part = parts[i];
		for (j = 2, len2 = part.length; j < len2; j += 2) {
			ctx[j ? 'lineTo' : 'moveTo'](part[j], part[j+1]);
		}
		if (closed) {
			ctx.closePath();
		}
	}

	this._fillStroke(ctx, layer);
}

L.spline = function (latlngs, options){
	return new L.Spline(latlngs, options);
};

