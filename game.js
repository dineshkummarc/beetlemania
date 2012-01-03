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

	function createArray(length, map) {
		var result = [], j;
		for (j = 0; j < length; j += 1) {
			if (typeof map === 'function') {
				result.push(map(j));
			} else {
				result.push(null);
			}
		}

		return result;
	}

	function getSubImage(image, x, y, width, height) {
		var canvas, ctx;

		canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;

		ctx = canvas.getContext('2d');
		ctx.drawImage(image, -x, -y);

		return canvas;
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
		game.loadImages(game.init);
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
			images = {
				font: null,
				score: null,
				bg: null,
				beetle: null,
				shell: null,
				star: null,
				digits: null,
				timer: null,
				heart: null,
				messages: null,
				bomb: null,
				space: null,
				title: null,
				gameOver: null,
				highscores: null,
				timeLeft: null
			},
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

		function loadImages(callback) {
			var files, count, postLoad;
			files = ['bg', 'bomb', 'digits', 'font', 'gameover', 'great', 'highscores', 'hp', 'nice', 'score', 'sprites2', 'sprites', 'time', 'title'];
			count = 0;

			files.forEach(function (file) {
				var image = new window.Image();
				image.onload = function () {
					files[file] = image;
					count += 1;
					if (count === files.length) {
						postLoad();
					}
				};

				image.src = 'images/' + file + '.gif';
			});

			postLoad = function () {
				var j;

				images.beetle = [];
				for (j = 0;j < 4;j += 1) {
					images.beetle[j] = getSubImage(files.sprites, j * SPRITE_WIDTH, 0, SPRITE_WIDTH, SPRITE_HEIGHT);
				}

				images.shell = [];
				for (j = 4;j < 8;j += 1) {
					images.shell[j - 4] = getSubImage(files.sprites, j * SPRITE_WIDTH, 0, SPRITE_WIDTH, SPRITE_HEIGHT);
				}

				images.star = [];
				for (j = 8;j < 16;j += 1) {
					images.star[j - 8] = getSubImage(files.sprites, j * SPRITE_WIDTH, 0, SPRITE_WIDTH, SPRITE_HEIGHT);
				}

				images.digits = [];
				for (j = 0;j < 11;j += 1) {
					images.digits[j] = getSubImage(files.digits, j * 25, 0, 25, 26);
				}

				images.timer = [];
				for (j = 0; j < 3; j += 1) {
					images.timer[j] = getSubImage(files.sprites2, j * 24, 0, 24, 26);
				}

				images.heart = getSubImage(files.sprites2, timer.length * 24, 2, 22, 22);
				images.messages = [files.great, files.hp, files.nice];
				images.bomb = files.bomb;
				images.space = files.space;
				images.title = files.title;
				images.gameOver = files.gameover;
				images.highscores = files.highscores;
				images.timeLeft = files.time;
				images.score = files.score;
				images.bg = files.bg;


				images.font = [];
				for (j = 0;j < 42;j++) {
					images.font[j] = getSubImage(files.font, 0, j * 16, 16, 16);
				}
			};
		}

		function init() {
			var j;
			showFPS = false;
			bullets = createArray(10);
			shells = createArray(35);
			points = createArray(shells.length); // points is the score increase displayed on the screen

			// there are NUM_STARS stars per shell
			stars = createArray(NUM_STARS * shells.length);

			// big messages on screen
			msg = [];
			msg[0] = 0; // message type (index to images.messages[])
			msg[1] = 0; // time to live (in milliseconds)

			pressCount = 0;
			scroll = 0;
			done = false;
			reset();
		}

		function reset() {
		}

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
			update: update,
			init: init,
			loadImages: loadImages
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
