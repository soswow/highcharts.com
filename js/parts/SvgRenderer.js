/**
 * The default SVG renderer
 */
var SVGRenderer = function() {
	this.init.apply(this, arguments);
};
SVGRenderer.prototype = {
	/**
	 * Initialize the SVGRenderer
	 * @param {Object} container
	 * @param {Number} width
	 * @param {Number} height
	 * @param {Boolean} forExport
	 */
	init: function(container, width, height, forExport) {
		var renderer = this,
			loc = location,
			boxWrapper;

		renderer.Element = SVGElement;
		boxWrapper = renderer.createElement('svg')
			.attr({
				xmlns: SVG_NS,
				version: '1.1'
			});
		container.appendChild(boxWrapper.element);

		// object properties
		renderer.box = boxWrapper.element;
		renderer.boxWrapper = boxWrapper;
		renderer.alignedObjects = [];
		renderer.url = isIE ? '' : loc.href.replace(/#.*?$/, ''); // page url used for internal references
		renderer.defs = this.createElement('defs').add();
		renderer.forExport = forExport;

		renderer.setSize(width, height, false);

	},


	/**
	 * Create a wrapper for an SVG element
	 * @param {Object} nodeName
	 */
	createElement: function(nodeName) {
		var wrapper = new this.Element();
		wrapper.init(this, nodeName);
		return wrapper;
	},


	/**
	 * Parse a simple HTML string into SVG tspans
	 *
	 * @param {Object} textNode The parent text SVG node
	 */
	buildText: function(wrapper) {
		var textNode = wrapper.element,
			lines = pick(wrapper.textStr, '').toString()
				.replace(/<(b|strong)>/g, '<span style="font-weight:bold">')
				.replace(/<(i|em)>/g, '<span style="font-style:italic">')
				.replace(/<a/g, '<span')
				.replace(/<\/(b|strong|i|em|a)>/g, '</span>')
				.split(/<br.*?>/g),
			childNodes = textNode.childNodes,
			styleRegex = /style="([^"]+)"/,
			hrefRegex = /href="([^"]+)"/,
			parentX = attr(textNode, 'x'),
			textStyles = wrapper.styles,
			reverse = isFirefox && textStyles && textStyles.HcDirection === 'rtl' && !this.forExport, // issue #38
			arr,
			width = textStyles && pInt(textStyles.width),
			textLineHeight = textStyles && textStyles['line-height'],
			lastLine,
			GET_COMPUTED_STYLE = 'getComputedStyle',
			i = childNodes.length;

		// remove old text
		while (i--) {
			textNode.removeChild(childNodes[i]);
		}

		if (width && !wrapper.added) {
			this.box.appendChild(textNode); // attach it to the DOM to read offset width
		}

		each(lines, function(line, lineNo) {
			var spans, spanNo = 0, lineHeight;

			line = line.replace(/<span/g, '|||<span').replace(/<\/span>/g, '</span>|||');
			spans = line.split('|||');

			each(spans, function (span) {
				if (span !== '' || spans.length === 1) {
					var attributes = {},
						tspan = doc.createElementNS(SVG_NS, 'tspan');
					if (styleRegex.test(span)) {
						attr(
							tspan,
							'style',
							span.match(styleRegex)[1].replace(/(;| |^)color([ :])/, '$1fill$2')
						);
					}
					if (hrefRegex.test(span)) {
						attr(tspan, 'onclick', 'location.href=\"'+ span.match(hrefRegex)[1] +'\"');
						css(tspan, { cursor: 'pointer' });
					}

					span = span.replace(/<(.|\n)*?>/g, '') || ' ';

					// issue #38 workaround.
					if (reverse) {
						arr = [];
						i = span.length;
						while (i--) {
							arr.push(span.charAt(i));
						}
						span = arr.join('');
					}

					// add the text node
					tspan.appendChild(doc.createTextNode(span));

					if (!spanNo) { // first span in a line, align it to the left
						attributes.x = parentX;
					} else {
						// Firefox ignores spaces at the front or end of the tspan
						attributes.dx = 3; // space
					}

					// first span on subsequent line, add the line height
					if (!spanNo) {
						if (lineNo) {

							// allow getting the right offset height in exporting in IE
							if (!hasSVG && wrapper.renderer.forExport) {
								css(tspan, { display: 'block' });
							}

							// Webkit and opera sometimes return 'normal' as the line height. In that
							// case, webkit uses offsetHeight, while Opera falls back to 18
							lineHeight = win[GET_COMPUTED_STYLE] &&
								win[GET_COMPUTED_STYLE](lastLine, null).getPropertyValue('line-height');

							if (!lineHeight || isNaN(lineHeight)) {
								lineHeight = textLineHeight || lastLine.offsetHeight || 18;
							}
							attr(tspan, 'dy', lineHeight);
						}
						lastLine = tspan; // record for use in next line
					}

					// add attributes
					attr(tspan, attributes);

					// append it
					textNode.appendChild(tspan);

					spanNo++;

					// check width and apply soft breaks
					if (width) {
						var words = span.replace(/-/g, '- ').split(' '),
							tooLong,
							actualWidth,
							rest = [];

						while (words.length || rest.length) {
							actualWidth = textNode.getBBox().width;
							tooLong = actualWidth > width;
							if (!tooLong || words.length === 1) { // new line needed
								words = rest;
								rest = [];
								if (words.length) {
									tspan = doc.createElementNS(SVG_NS, 'tspan');
									attr(tspan, {
										dy: textLineHeight || 16,
										x: parentX
									});
									textNode.appendChild(tspan);

									if (actualWidth > width) { // a single word is pressing it out
										width = actualWidth;
									}
								}
							} else { // append to existing line tspan
								tspan.removeChild(tspan.firstChild);
								rest.unshift(words.pop());
							}
							if (words.length) {
								tspan.appendChild(doc.createTextNode(words.join(' ').replace(/- /g, '-')));
							}
						}
					}
				}
			});
		});


	},

	/**
	 * Create a button with preset states
	 * @param {String} text
	 * @param {Number} x
	 * @param {Number} y
	 * @param {Function} callback
	 * @param {Object} normalState
	 * @param {Object} hoverState
	 * @param {Object} pressedState
	 */
	button: function(text, x, y, callback, normalState, hoverState, pressedState) {
		normalState = merge(hash(
			STROKE_WIDTH, 1,
			STROKE, '#999',
			FILL, hash(
				LINEAR_GRADIENT, [0, 0, 0, 14],
				STOPS, [
					[0, '#FFF'],
					[1, '#DDD']
				]
			),
			'r', 3,
			'padding', 3
		), normalState);

		hoverState = merge(normalState, hash(
			STROKE, '#68A',
			FILL, hash(
				LINEAR_GRADIENT, [0, 0, 0, 14],
				STOPS, [
					[0, '#FFF'],
					[1, '#ACF']
				]
			)
		), hoverState);

		pressedState = merge(normalState, hash(
			STROKE, '#68A',
			FILL, hash(
				LINEAR_GRADIENT, [0, 0, 0, 14],
				STOPS, [
					[0, '#9BD'],
					[1, '#CDF']
				]
			)
		), pressedState);
		var label = this.label(text, x, y),
			curState = 0,
			stateOptions;

		addEvent(label.element, 'mouseenter', function() {
			label.attr(hoverState)
				.css(hoverState.style);
		});
		addEvent(label.element, 'mouseleave', function() {
			stateOptions = [normalState, hoverState, pressedState][curState];
			label.attr(stateOptions)
				.css(stateOptions.style);
		});

		label.setState = function(state) {
			curState = state;
			if (!state) {
				label.attr(normalState)
					.css(normalState.style);
			} else if (state === 2) {
				label.attr(pressedState)
					.css(pressedState.style);
			}
		};

		return label.css({ cursor: 'default' })
			.on('click', function() {
				callback.call(label);
			})
			.attr(normalState)
			.css(normalState.style);

	},

	/**
	 * Make a straight line crisper by not spilling out to neighbour pixels
	 * @param {Array} points
	 * @param {Number} width
	 */
	crispLine: function(points, width) {
		// points format: [M, 0, 0, L, 100, 0]
		// normalize to a crisp line
		if (points[1] === points[4]) {
			points[1] = points[4] = mathRound(points[1]) + (width % 2 / 2);
		}
		if (points[2] === points[5]) {
			points[2] = points[5] = mathRound(points[2]) + (width % 2 / 2);
		}
		return points;
	},


	/**
	 * Draw a path
	 * @param {Array} path An SVG path in array form
	 */
	path: function (path) {
		return this.createElement('path').attr({
			d: path,
			fill: NONE
		});
	},

	/**
	 * Draw and return an SVG circle
	 * @param {Number} x The x position
	 * @param {Number} y The y position
	 * @param {Number} r The radius
	 */
	circle: function (x, y, r) {
		var attr = isObject(x) ?
			x :
			{
				x: x,
				y: y,
				r: r
			};

		return this.createElement('circle').attr(attr);
	},

	/**
	 * Draw and return an arc
	 * @param {Number} x X position
	 * @param {Number} y Y position
	 * @param {Number} r Radius
	 * @param {Number} innerR Inner radius like used in donut charts
	 * @param {Number} start Starting angle
	 * @param {Number} end Ending angle
	 */
	arc: function (x, y, r, innerR, start, end) {
		// arcs are defined as symbols for the ability to set
		// attributes in attr and animate

		if (isObject(x)) {
			y = x.y;
			r = x.r;
			innerR = x.innerR;
			start = x.start;
			end = x.end;
			x = x.x;
		}
		return this.symbol('arc', x || 0, y || 0, r || 0, r || 0, {
			innerR: innerR || 0,
			start: start || 0,
			end: end || 0
		});
	},

	/**
	 * Draw and return a rectangle
	 * @param {Number} x Left position
	 * @param {Number} y Top position
	 * @param {Number} width
	 * @param {Number} height
	 * @param {Number} r Border corner radius
	 * @param {Number} strokeWidth A stroke width can be supplied to allow crisp drawing
	 */
	rect: function (x, y, width, height, r, strokeWidth) {
		if (isObject(x)) {
			y = x.y;
			width = x.width;
			height = x.height;
			r = x.r;
			x = x.x;
		}
		var wrapper = this.createElement('rect').attr({
			rx: r,
			ry: r,
			fill: NONE
		});

		return wrapper.attr(wrapper.crisp(strokeWidth, x, y, mathMax(width, 0), mathMax(height, 0)));
	},

	/**
	 * Resize the box and re-align all aligned elements
	 * @param {Object} width
	 * @param {Object} height
	 * @param {Boolean} animate
	 *
	 */
	setSize: function(width, height, animate) {
		var renderer = this,
			alignedObjects = renderer.alignedObjects,
			i = alignedObjects.length;

		renderer.width = width;
		renderer.height = height;

		renderer.boxWrapper[pick(animate, true) ? 'animate' : 'attr']({
			width: width,
			height: height
		});

		while (i--) {
			alignedObjects[i].align();
		}
	},

	/**
	 * Create a group
	 * @param {String} name The group will be given a class name of 'highcharts-{name}'.
	 *     This can be used for styling and scripting.
	 */
	g: function(name) {
		return this.createElement('g').attr(
			defined(name) && { 'class': PREFIX + name }
		);
	},

	/**
	 * Display an image
	 * @param {String} src
	 * @param {Number} x
	 * @param {Number} y
	 * @param {Number} width
	 * @param {Number} height
	 */
	image: function(src, x, y, width, height) {
		var attribs = {
				preserveAspectRatio: NONE
			},
			elemWrapper;

		// optional properties
		if (arguments.length > 1) {
			extend(attribs, {
				x: x,
				y: y,
				width: width,
				height: height
			});
		}

		elemWrapper = this.createElement('image').attr(attribs);

		// set the href in the xlink namespace
		elemWrapper.element.setAttributeNS('http://www.w3.org/1999/xlink',
			'href', src);

		return elemWrapper;
	},

	/**
	 * Draw a symbol out of pre-defined shape paths from the namespace 'symbol' object.
	 *
	 * @param {Object} symbol
	 * @param {Object} x
	 * @param {Object} y
	 * @param {Object} radius
	 * @param {Object} options
	 */
	symbol: function(symbol, x, y, width, height, options) {

		var obj,

			// get the symbol definition function
			symbolFn = this.symbols[symbol],

			// check if there's a path defined for this symbol
			path = symbolFn && symbolFn(
				x,
				y,
				width,
				height,
				options
			),

			imageRegex = /^url\((.*?)\)$/,
			imageSrc;

		if (path) {

			obj = this.path(path);
			// expando properties for use in animate and attr
			extend(obj, {
				symbolName: symbol,
				x: x,
				y: y,
				width: width,
				height: height
			});
			if (options) {
				extend(obj, options);
			}


		// image symbols
		} else if (imageRegex.test(symbol)) {

			imageSrc = symbol.match(imageRegex)[1];

			// create the image synchronously, add attribs async
			obj = this.image(imageSrc)
				.attr({
					x: x,
					y: y
				});

			// create a dummy JavaScript image to get the width and height
			createElement('img', {
				onload: function() {
					var img = this,
						size = symbolSizes[img.src] || [img.width, img.height];
					obj.attr({
						width: size[0],
						height: size[1]
					}).translate(
						-mathRound(size[0] / 2),
						-mathRound(size[1] / 2)
					);
				},
				src: imageSrc
			});
		}

		return obj;
	},

	/**
	 * An extendable collection of functions for defining symbol paths.
	 */
	symbols: {
		'circle': function (x, y, w, h) {
			var cpw = 0.166 * w;
			return [
				M, x + w / 2, y,
				'C', x + w + cpw, y, x + w + cpw, y + h, x + w / 2, y + h,
				'C', x - cpw, y + h, x - cpw, y, x + w / 2, y,
				'Z'
			];
		},

		'square': function (x, y, w, h) {
			return [
				M, x, y,
				L, x + w, y,
				x + w, y + h,
				x, y + h,
				'Z'
			];
		},

		'triangle': function (x, y, w, h) {
			return [
				M, x + w / 2, y,
				L, x + w, y + h,
				x, y + h,
				'Z'
			];
		},

		'triangle-down': function (x, y, w, h) {
			return [
				M, x, y,
				L, x + w, y,
				x + w / 2, y + h,
				'Z'
			];
		},
		'diamond': function (x, y, w, h) {
			return [
				M, x + w / 2, y,
				L, x + w, y + h / 2,
				x + w / 2, y + h,
				x, y + h / 2,
				'Z'
			];
		},
		'arc': function (x, y, w, h, options) {
			var start = options.start,
				radius = w,
				end = options.end - 0.000001, // to prevent cos and sin of start and end from becoming equal on 360 arcs
				innerRadius = options.innerR,
				cosStart = mathCos(start),
				sinStart = mathSin(start),
				cosEnd = mathCos(end),
				sinEnd = mathSin(end),
				longArc = options.end - start < mathPI ? 0 : 1;

			return [
				M,
				x + radius * cosStart,
				y + radius * sinStart,
				'A', // arcTo
				radius, // x radius
				radius, // y radius
				0, // slanting
				longArc, // long or short arc
				1, // clockwise
				x + radius * cosEnd,
				y + radius * sinEnd,
				L,
				x + innerRadius * cosEnd,
				y + innerRadius * sinEnd,
				'A', // arcTo
				innerRadius, // x radius
				innerRadius, // y radius
				0, // slanting
				longArc, // long or short arc
				0, // clockwise
				x + innerRadius * cosStart,
				y + innerRadius * sinStart,

				'Z' // close
			];
		}
	},

	/**
	 * Define a clipping rectangle
	 * @param {String} id
	 * @param {Number} x
	 * @param {Number} y
	 * @param {Number} width
	 * @param {Number} height
	 */
	clipRect: function (x, y, width, height) {
		var wrapper,
			id = PREFIX + idCounter++,

			clipPath = this.createElement('clipPath').attr({
				id: id
			}).add(this.defs);

		wrapper = this.rect(x, y, width, height, 0).add(clipPath);
		wrapper.id = id;

		return wrapper;
	},


	/**
	 * Take a color and return it if it's a string, make it a gradient if it's a
	 * gradient configuration object
	 *
	 * @param {Object} color The color or config object
	 */
	color: function(color, elem, prop) {
		var colorObject,
			regexRgba = /^rgba/;
		if (color && color.linearGradient) {
			var renderer = this,
				strLinearGradient = 'linearGradient',
				linearGradient = color[strLinearGradient],
				id = PREFIX + idCounter++,
				gradientObject,
				stopColor,
				stopOpacity;
			gradientObject = renderer.createElement(strLinearGradient).attr({
				id: id,
				gradientUnits: 'userSpaceOnUse',
				x1: linearGradient[0],
				y1: linearGradient[1],
				x2: linearGradient[2],
				y2: linearGradient[3]
			}).add(renderer.defs);

			each(color.stops, function(stop) {
				if (regexRgba.test(stop[1])) {
					colorObject = Color(stop[1]);
					stopColor = colorObject.get('rgb');
					stopOpacity = colorObject.get('a');
				} else {
					stopColor = stop[1];
					stopOpacity = 1;
				}
				renderer.createElement('stop').attr({
					offset: stop[0],
					'stop-color': stopColor,
					'stop-opacity': stopOpacity
				}).add(gradientObject);
			});

			return 'url('+ this.url +'#'+ id +')';

		// Webkit and Batik can't show rgba.
		} else if (regexRgba.test(color)) {
			colorObject = Color(color);
			attr(elem, prop +'-opacity', colorObject.get('a'));

			return colorObject.get('rgb');


		} else {
			return color;
		}

	},


	/**
	 * Add text to the SVG object
	 * @param {String} str
	 * @param {Number} x Left position
	 * @param {Number} y Top position
	 */
	text: function(str, x, y) {

		// declare variables
		var renderer = this,
			defaultChartStyle = defaultOptions.chart.style,
			wrapper,
			box;

		x = mathRound(pick(x, 0));
		y = mathRound(pick(y, 0));

		wrapper = renderer.createElement('text')
			.attr({
				x: x,
				y: y,
				text: str
			})
			.css({
				'font-family': defaultChartStyle.fontFamily,
				'font-size': defaultChartStyle.fontSize
			});

		wrapper.x = x;
		wrapper.y = y;
		return wrapper;
	},

	/**
	 * Add a label, a text item that can hold a colored or gradient background
	 * as well as a border and shadow.
	 * @param {string} str
	 * @param {Number} x
	 * @param {Number} y
	 * @param {String} shape
	 * @param {Number} anchorX In case the shape has a pointer, like a flag, this is the
	 *    coordinates it should be pinned to
	 * @param {Number} anchorY
	 */
	label: function(str, x, y, shape, anchorX, anchorY) {

		var renderer = this,
			wrapper = renderer.text(str),
			box,
			bBox,
			align = 'left',
			padding = 2,
			width,
			height,
			xAdjust,
			deferredAttr = {};

		function updateBoxSize() {
			bBox = (width === undefined || height === undefined) && wrapper.getBBox();
			var w = (width || bBox.width) + 2 * padding,
				h = (height || bBox.height) + 2 * padding,
				anchors;

			xAdjust = mathRound(w * { left: 0, center: 0.5, right: 1 }[align]);
			anchors = anchorX !== undefined && {
				anchorX: anchorX - x + xAdjust,
				anchorY: anchorY - y
			};

			if (!box) {
				wrapper.box = box = shape ?
					renderer.symbol(shape, 0, 0, w, h, anchors) :
					renderer.rect(0, 0, w, h, 0, deferredAttr['stroke-width']);
				box.add(); // to get the translation right in IE
			}

			box.attr(merge({
				width: w,
				height: h
			}, anchors, deferredAttr));
			deferredAttr = null;
		}

		/**
		 * Set box attributes, or defer them if the box is not yet created
		 * @param {Object} key
		 * @param {Object} value
		 */
		function boxAttr(key, value) {
			if (box) {
				box.attr(key, value);
			} else {
				deferredAttr[key] = value;
			}

		}

		addEvent(wrapper, 'add', function() {


			updateBoxSize();

			var boxElem = box.element,
				wrapperElem = wrapper.element,
				zIndex = attr(wrapperElem, 'zIndex');
			if (defined(zIndex)) {
				attr(boxElem, 'zIndex', zIndex);
			}
			wrapperElem.parentNode.insertBefore(boxElem, wrapperElem);


			wrapper.attr({
				x: x,
				y: y
			});
		});

		addEvent(wrapper, 'setAttr', function(e) {
			var key = e.key,
				value = e.value,
				elem = wrapper,
				textAlign,
				ret;

			// change local variables
			if (key === 'width') {
				width = value;
				ret = false;
			} else if (key === 'height') {
				height = value;
				ret = false;
			} else if (key === 'padding') {
				padding = value;
				ret = false;

			// change local variable and set attribue as well
			} else if (key === 'align') {
				align = value;
				//ret = false;

			// apply these to the box and the text alike
			} else if (key === 'visibility' || key === 'zIndex') {
				boxAttr(key, value);
			}

			// apply these to the box but not to the text
			else if (key === 'stroke' || key === 'stroke-width' || key === 'fill' || key === 'r') {
				boxAttr(key, value);
				ret = false;
			}

			// change box attributes and return modified values
			else if (key === 'x') {
				textAlign = wrapper.element.style.textAlign;
				boxAttr('translateX', value - xAdjust);
				if (align === 'left' && defined(width) && (textAlign === 'center' || textAlign === 'right')) {
					value += { center: 0.5, right: 1 }[textAlign] * (width - bBox.width);
				}
				ret = mathRound(value + { left: 1, center: 0, right: -1 }[align] * padding);
			} else if (key === 'y') {
				boxAttr('translateY', value);
				ret = mathRound(value + pInt(wrapper.element.style.fontSize || 12) * 1.2);
			}

			else if (key === 'text') {
				e.callback = updateBoxSize;
			}
			if (ret !== UNDEFINED) {
				return ret;
			}
		});

		wrapper.txtToFront = wrapper.toFront;

		return extend(wrapper, {
			shadow: function(b) {
				box.shadow(b);
				return wrapper;
			},
			toFront: function() {
				box.toFront();
				wrapper.txtToFront();
			}
		});
	}
}; // end SVGRenderer


// general renderer
Renderer = SVGRenderer;