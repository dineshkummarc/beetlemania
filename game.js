(function (window, document) {
	var width = 512, height = 448, repaint, context, lastUpdate, game, Rectangle;

	function createCanvas(width, height, node) {
		var canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;

		if (node) {
			node.appendChild(canvas);
			canvas.tabIndex = 0;
			canvas.focus();
			canvas.addEventListener('keydown', function (e) {
				if (game.captureKey(e.keyCode)) {
					game.keyPressed(e.keyCode);
					e.preventDefault();
					return false;
				}
			}, false);
			canvas.addEventListener('keyup', function (e) {
				if (game.captureKey(e.keyCode)) {
					game.keyReleased(e.keyCode);
					e.preventDefault();
					return false;
				}
			}, false);
		}

		return canvas.getContext('2d');
	}

	function rand(min, max) {
		return min + Math.floor(Math.random() * (max - min));
	}

	Math.toRadians = Math.toRadians || function (degrees) {
		return degrees * (Math.PI / 180);
	};

	repaint = window.requestAnimationFrame ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		window.oRequestAnimationFrame ||
		function (callback) {
			window.setTimeout(function () {
				callback(Date.now());
			}, 20);
		};


	function update(time, force) {
		repaint(update);
		var delta = time - lastUpdate;
		if (delta >= 16 || force) { // Cap at 60 FPS
			lastUpdate = time;

			game.update(delta);
			game.render(context);
		}
	}

	function init() {
		context = createCanvas(width, height, document.body);
		lastUpdate = Date.now();
		update(lastUpdate);
	}


	game = (function () {
		var keys,
			WIDTH = 512,
			HEIGHT = 448,
			SPRITE_WIDTH = 32,
			SPRITE_HEIGHT = 32,
			NUM_STARS = 15, // stars per shell
			BG = '#339966',
			GRAV = 0.05,
			MAX_SQUISH_TIME = 5000,
			MAX_BLINK_TIME = 2000,
			STATE_TITLE = 0,
			STATE_GAME = 1,
			STATE_GAME_OVER = 2,
			STATE_INPUT = 3,
			STATE_SUBMITTING = 4,
			STATE_ERROR = 5,
			STATE_SCORES = 6,
			GAME_DURATION = 3*60*1000,
			state, // game state
			beetle = [],
			shell = [],
			star = [],
			digits = [],
			timer = [],
			heart,
			bg,
			scoreImg,
			msgImgs = [],
			bomb,
			font = [],
			title,
			space,
			gameOver,
			timeLeftImg,
			beetleBounds,
			heartBounds,
			bombBounds,
			frame,
			beetleTime,
			bgTime,
			animTime,
			moveTime,
			squishTime,
			scroll,
			beetleFrame,
			animFrame,
			numShells,
			maxShells,
			keys = [],
			bullets = [],
			score,
			points = [],
			blinkTime,
			blinkState,
			msg = [],
			bombScore,
			bombDir,
			timeLeft,
			inputChars = [],
			input,
			shells = [],
			stars = [],
			fps,
			mute,
			squished,
			showFPS,
			pressCount, // times spacebar was pressed while squished
			pressMax, // times spacebar must be pressed to recover from being squished
			done;

		keys = {
			spacebar: 32,
			left: 37,
			up: 38,
			right: 39,
			down: 40
		};

		function update(delta) {
		}

		function render(ctx) {
			ctx.fillStyle = BG;
			ctx.fillRect(0, 0, width, height);
		}

		return ({
			/* Return true if game should capture the provided key code */
			captureKey: (function () {
				var codes = {};
				Object.keys(keys).forEach(function (key) {
					codes[keys[key]] = true;
				});

				return function (code) {
					return !!codes[code];
				};
			}()),

			keyPressed: function (code) {
				/* -1 means user must release key before pressing it */
				if (keys[code] !== -1) {
					keys[code] = 1;
				}

				update(Date.now(), true);
			},

			keyReleased: function (code) {
				keys[code] = 0;
			},

			render: render,
			update: update
		});
	}());

	Rectangle = function (x, y, width, height) {
		if (x.constructor && x.constructor === Rectangle) {
			this.x = x.x;
			this.y = x.y;
			this.width = x.width;
			this.height = x.height;
		} else {
			this.x = +x || 0;
			this.y = +y || 0;
			this.width = +width || 1;
			this.height = +height || 1;
		}
	};

	Rectangle.prototype.contains = function (x, y) {
		return (
			(x >= this.x && x <= this.x + this.width) &&
			(y >= this.y && y <= this.y + this.height)
		);
	};

	/* modified from the java.awt.Rectangle source code */
	Rectangle.prototype.intersects = function (rect) {
		var tw, th, rw, rh, tx, ty, rx, ry;

		tw = this.width;
		th = this.height;
		rw = r.width;
		rh = r.height;
		if (rw <= 0 || rh <= 0 || tw <= 0 || th <= 0) {
			return false;
		}
		tx = this.x;
		ty = this.y;
		rx = r.x;
		ry = r.y;
		rw += rx;
		rh += ry;
		tw += tx;
		th += ty;
		//      overflow || intersect
		return ((rw < rx || rw > tx) &&
			(rh < ry || rh > ty) &&
			(tw < tx || tw > rx) &&
			(th < ty || th > ry));
	};

	init();
}(this, this.document));
