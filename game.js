(function (window, document) {
	var width = 512, height = 448, frameCount = 0, repaint, context, lastUpdate, game, Rectangle;

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
				result.push({});
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
			frameCount += 1;
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
			fontCharMap = {
				'_': 36,
				'-': 37,
				'.': 38,
				':': 39,
				' ': 40
			},
			images = {
				font: null,
				score: null,
				bg: null,
				beetle: null,
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
			down: 40,
			f: 70,
			r: 82
		};

		function loadImages(callback) {
			var files, count, postLoad;
			files = ['bg', 'bomb', 'digits', 'font', 'gameover', 'great', 'highscores', 'hp', 'nice', 'score', 'space', 'sprites2', 'sprites', 'time', 'title'];
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

				images.star = [];
				for (j = 8;j < 16;j += 1) {
					images.star[j - 8] = getSubImage(files.sprites, j * SPRITE_WIDTH, 0, SPRITE_WIDTH, SPRITE_HEIGHT);
				}

				images.timer = [];
				for (j = 0; j < 3; j += 1) {
					images.timer[j] = getSubImage(files.sprites2, j * 24, 0, 24, 26);
				}

				images.sprites = files.sprites;
				images.heart = getSubImage(files.sprites2, images.timer.length * 24, 2, 22, 22);
				images.messages = [files.great, files.hp, files.nice];
				images.bomb = files.bomb;
				images.space = files.space;
				images.title = files.title;
				images.gameOver = files.gameover;
				images.highscores = files.highscores;
				images.timeLeft = files.time;
				images.score = files.score;
				images.bg = files.bg;
				images.digits = files.digits;
				images.font = files.font;

				if (typeof callback === 'function') {
					callback();
				}
			};
		}

		function resetShell(j) {
			shells[j].x = rand(0,WIDTH); // x
			shells[j].y = -SPRITE_HEIGHT; // y
			shells[j].vx = 2.0;
			shells[j].vy = 0.0; // y velocity

			points[j].x = 0; // x
			points[j].y = 0; // y
			points[j].score = 0; // score
			points[j].life = 0; // life
		}

		function clearAllShells(scr) {
			var inc = 0,j,n,x;

			for (j = 0;j < shells.length;j++) {
				if (shells[j].y > 0) { // on screen
					for (n = 0;n < NUM_STARS;n++) {
						x = (j+1)*n;
						stars[x].x = shells[j].x;
						stars[x].y = shells[j].y;
						stars[x].velocity = rand(2,4);
						stars[x].angle = rand(0,360);
						stars[x].scoreAmount = scr+1;
						stars[x].timeToLive = rand(20,40);
					}
					points[j].x = shells[j].x;
					points[j].y = shells[j].y;
					points[j].score = Math.pow(2,scr);
					points[j].life = 100;
					shells[j].x = rand(0,WIDTH); // x
					shells[j].y = -SPRITE_HEIGHT; // y
					//shells[j].vx = rand(-5.0,5.0); // x velocity
					shells[j].vx = 2;
					shells[j].vy = 0.0; // y velocity
					inc+=Math.pow(2,scr);
				}
			}
			score+=inc;
			numShells = 0;
			maxShells = 1;
		}

		function hitShell(n, scr) {
			var inc, j, x, tmp;

			if (maxShells < shells.length) {
				maxShells = Math.min(maxShells+1,shells.length);
			}

			if (scr >= 0) {
				if (scr < 13) {
					inc = Math.pow(2,scr);
				} else {
					inc = 9999;
				}
			} else {
				inc = 0;
			}

			score+=inc;
			// if chain reaction is 10 shells or more, display heart
			if (scr >= 9 && heartBounds.x == -images.heart.width && heartBounds.y == -images.heart.height) {
				heartBounds.x = shells[n].x;
				//heartBounds.y = shells[n].y;
				heartBounds.y = 0;
				msg[0] = 2;
				msg[1] = 1000;
			}

			numShells = Math.max(0,numShells-1);

			// shoot off the stars
			for (j = 0;j < NUM_STARS;j++) {
				x = (n+1)*j;
				stars[x].x = shells[n].x;
				stars[x].y = shells[n].y;
				stars[x].velocity = rand(2,4);
				stars[x].angle = rand(0,360);
				stars[x].scoreAmount = scr+1;
				stars[x].timeToLive = rand(20,40);
			}

			
			tmp = shells[n];
			if (n < shells.length-1) {
				for (x = n;x < shells.length-1;x++) {
					shells[x] = shells[x+1];
				}
			}
			points[n].x = tmp.x;
			points[n].y = tmp.y;
			points[n].score = inc;
			points[n].life = 100;
			tmp.x = rand(0,WIDTH); // x
			tmp.y = -rand(SPRITE_HEIGHT,SPRITE_HEIGHT*4); // y
			//tmp.vx = rand(-5.0,5.0); // x velocity
			tmp.vx = 2;
			tmp.vy = 0.0; // y velocity
			shells[shells.length-1] = tmp;
		}

		function isKeyDown(code) {
			return (keys[code] === 1);
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
			var j;
			score = 0;
			frame = 0;
			bgTime = 0;
			beetleTime = 0;
			moveTime = 0;
			bombScore = 500; // the minimum score needed before bomb bonus can appear
			bombDir = 0; // direction of bomb. 0 = left, 1 = right
			beetleFrame = 0;
			beetleBounds = new Rectangle((WIDTH / 2) - (SPRITE_WIDTH / 2), HEIGHT - SPRITE_HEIGHT - (SPRITE_HEIGHT / 2), SPRITE_WIDTH, SPRITE_HEIGHT);
			heartBounds = new Rectangle(-images.heart.width, -images.heart.height, images.heart.width, images.heart.height);
			bombBounds = new Rectangle(-images.bomb.width, -images.bomb.height, 40, 40);
			animFrame = 0;
			animTime = 0;
			blinkTime = 0;
			blinkState = 0;
			squished = false;
			numShells = 0;
			maxShells = 1;
			scores = '';
			pressMax = 15;
			squishTime = 0;
			fps = 'FPS: 0';
			input = '';

			for (j = 0;j < shells.length;j++) {
				shells[j].x = rand(0, WIDTH); // x
				shells[j].y = -SPRITE_HEIGHT; // y
				shells[j].vx = 2.0;
				shells[j].vy = 0.0; // y velocity

				points[j].x = 0; // x
				points[j].y = 0; // y
				points[j].score = 0; // score
				points[j].life = 0; // life
			}

			for (j = 0;j < stars.length;j++) {
				stars[j].x = rand(0, WIDTH); // x
				stars[j].y = 100.0; // y
				stars[j].velocity = 10; // velocity
				stars[j].angle = rand(0, 360); // degree of movement
				stars[j].scoreAmount = 1.0; // score amount (2^stars[j].scoreAmount)
				stars[j].timeToLive = 0.0; // time to live
			}

			for (j = 0;j < bullets.length;j++) {
				bullets[j].x = 0; // x
				bullets[j].y = -SPRITE_HEIGHT; // y
			}

			timeLeft = GAME_DURATION;
			state = STATE_TITLE;
		}

		function getChar(chr) { 
			var x = chr.toUpperCase().charCodeAt(0);

			if (x >= 65 && x <= 90) { // A-Z
				return x-65;
			}
			else if (x >= 48 && x <= 57) { // 0-9
				return 26+x-48;
			} else if (typeof fontCharMap[chr] === 'number') {
				return fontCharMap[chr];
			}

			return 41;
		}

		function isCharSupported(chr) {
			var x = chr.toUpperCase().charCodeAt(0);
			return ((x >= 65 && x <= 90) || (x >= 48 && x <= 57) || typeof fontCharMap[c] === 'number');
		}

		function drawText(ctx, str, x, y) {
			var j, startx = 0 + x;
			for (j = 0; j < str.length; j += 1) {
				if (str.charAt(j) === '\n') {
					y += 16 + 8;
					x = 0 + startx;
				} else {
					x += 16;
					ctx.drawImage(images.font, 0, getChar(str.charAt(j)) * 16, 16, 16, x - 16, y, 16, 16); 
				}
			}
		}

		function drawDigit(ctx, n, x, y) {
			ctx.drawImage(images.digits, n * 25, 0, 25, 26, x, y, 25, 26); 
		}

		function drawShell(ctx, x, y, animFrame) {
			ctx.drawImage(
				images.sprites,
				(4 * SPRITE_WIDTH) + animFrame * SPRITE_WIDTH, 0,
				SPRITE_WIDTH, SPRITE_HEIGHT,
				x, y, SPRITE_WIDTH, SPRITE_HEIGHT
			);
		}

		function drawTime(ctx, str, x, y) {
			var n, w, j;

			for (j = 0; j < str.length; j += 1) {
				w = 0;

				if (str.charAt(j) === ':') {
					n = 10;
					w = -5;
				} else {
					n = parseInt(str.charAt(j));
					if (j < str.length - 1 && str.charAt(j + 1) === ':') {
						w = -5;
					}
				}

				drawDigit(ctx, n, x, y);
				x += 25 + w;
			}
		}

		function drawScore(ctx) {
			var j, x, s = String(score);

			x = WIDTH - 5;
			for (j = s.length-1; j >= 0; j -= 1) {
				x -= 25;
				drawDigit(ctx, parseInt(s.charAt(j)), x, 5);
			}

			ctx.drawImage(images.score, x - images.score.width - 5, 5);
		}

		function update(delta) {
			var old, inc, j, src, target, n, r;

			if (blinkTime > 0) {
				blinkTime = Math.max(blinkTime - delta, 0);
			}

			if (msg[1] > 0) {
				msg[1] = Math.max(msg[1] - delta, 0);
			}

			frame+=delta;

			while (frame >= 1000) {
				fps = 'FPS: ' + frameCount;
				frameCount = 0;
				frame = frame - 1000;
				if (state == STATE_GAME) {
					if (numShells < maxShells && !squished) {
						old = numShells;
						numShells = Math.min(numShells+rand(3,7),maxShells);
						inc = 2;
						for (old = old;old < numShells;old++) {
							shells[old].y -= SPRITE_HEIGHT * inc;
							inc*=2;
						}
					}
					if (score >= bombScore && bombBounds.x <= -images.bomb.width && rand(0,100) <= 2) {
						bombBounds.x = WIDTH+images.bomb.width;
						bombBounds.y = rand(58,HEIGHT / 4);
						bombDir = 1;
						if (beetleBounds.x + (beetleBounds.width / 2) >= (WIDTH / 2)) {
							bombDir = 0;
						}
					}
				}
			}

			bgTime += delta;
			while (bgTime >= 25) {
				scroll -= 1;
				if (scroll < -images.bg.width) {
					scroll = 0;
				}

				bgTime-=25;

				if (blinkTime > 0) {
					blinkState ^= 1;
				}
			}

			beetleTime += delta;
			while (beetleTime >= 100) {
				beetleFrame ^= 1;
				beetleTime -= 100;
			}

			if (state == STATE_GAME) {
				timeLeft -= delta;
				if (timeLeft <= 0) {
					state = STATE_GAME_OVER;
				}

				moveTime += delta;
			}

			while (moveTime >= 10) {
				moveTime -= 10;

				// beetle movement
				if (!squished) {
					if (isKeyDown(keys.left)) {
						beetleBounds.x-=2;
					}
					if (isKeyDown(keys.right)) {
						beetleBounds.x+=2;
					}

					if (beetleBounds.x < 0) {
						beetleBounds.x = 0;
					}
					if (beetleBounds.x > WIDTH-SPRITE_WIDTH) {
						beetleBounds.x = WIDTH-SPRITE_WIDTH;
					}
				}
				
				// bomb/lakitu movement
				if (bombBounds.x > -images.bomb.width) {
					bombBounds.x-=3;
					if (bombBounds.x <= -images.bomb.width) {
						bombScore = score+500;
					}
				}

				// bullet firing
				if (!squished && isKeyDown(keys.spacebar)) {
					for (j = 0;j < bullets.length;j++) {
						if (bullets[j].y <= -SPRITE_HEIGHT) {
							bullets[j].x = beetleBounds.x;
							bullets[j].y = beetleBounds.y-(SPRITE_HEIGHT>>1);
							break;
						}
					}
					keys[keys.spacebar] = -2;
				}

				// bullet movement
				for (j = 0;j < bullets.length;j++) {
					if (bullets[j].y > -SPRITE_HEIGHT) {
						bullets[j].y-=5;
					}
				}

				// shell movement
				for (j = 0;j < numShells;j++) {
					if (shells[j].y <= -SPRITE_HEIGHT && shells[j].y+shells[j].vy > -SPRITE_HEIGHT) {
						shells[j].y+=shells[j].vy;
						shells[j].vy = 0;
					} else {
						shells[j].y+=shells[j].vy;
					}

					shells[j].x+=shells[j].vx;

					if (shells[j].x <= 0) { // bounce off left wall
						shells[j].x = 0;
						shells[j].vx*=-1;
					}

					if (shells[j].x >= WIDTH-SPRITE_WIDTH) { // bounce off right wall
						shells[j].x = WIDTH-SPRITE_WIDTH;
						shells[j].vx*=-1;
					}

					if (shells[j].y >= HEIGHT-SPRITE_HEIGHT) { // bounce off ground
						shells[j].y = HEIGHT-SPRITE_HEIGHT;
						shells[j].vy = -rand(3.0,6.5);
					}

					// gravity pulls
					//shells[j].vy = Math.min(shells[j].vy+GRAV,6);
					shells[j].vy+=GRAV;
				}

				// stars movement
				for (j = 0;j < stars.length;j++) {
					if (stars[j].timeToLive > 0.0) {
						stars[j].x+=Math.cos(Math.toRadians(stars[j].angle))*stars[j].velocity;
						stars[j].y+=Math.sin(Math.toRadians(stars[j].angle))*stars[j].velocity;
						stars[j].timeToLive-=1.0;
					}
				}

				// points movement
				for (j = 0;j < points.length;j++) {
					if (points[j].life > 0) {
						points[j].y--;
						points[j].life--;
					}
				}

				// collision detection
				src = new Rectangle(0,0,SPRITE_WIDTH,SPRITE_HEIGHT);
				target = new Rectangle(0,0,SPRITE_WIDTH,SPRITE_HEIGHT);
				for (n = 0;n < numShells;n++) {
					if (shells[n].y < 0) {
						continue;
					}

					// collision with bullets
					for (j = 0;j < bullets.length;j++) {
						if (bullets[j].y < 0) {
							continue;
						}
						src.x = bullets[j].x;
						src.y = bullets[j].y;
						target.x = shells[n].x;
						target.y = shells[n].y;
						if (src.intersects(target)) { // collision
							bullets[j].y = -SPRITE_HEIGHT; // bullet disappears
							hitShell(n,0);
							break;
						}
					}

					// collision with red stars
					for (j = 0;j < stars.length;j++) {
						if (stars[j].y >= 0.0 && stars[j].timeToLive > 0.0) {
							src.x = stars[j].x;
							src.y = stars[j].y;
							target.x = shells[n].x;
							target.y = shells[n].y;
							if (target.y >= 0 && src.intersects(target)) { // collision
								stars[j].timeToLive = 0.0;
								hitShell(n,stars[j].scoreAmount);
								break;
							}
						}
					}
					target.x = shells[n].x;
					target.y = shells[n].y;

					// collision with beetle
					if (!squished && blinkTime <= 0 && target.intersects(beetleBounds)) { // collision
						squished = true;
						squishTime = 0;
						pressMax+=3;
						pressCount = 0;
					}
				}

				// bullet collision with bomb
				for (j = 0;j < bullets.length;j++) {
					if (bullets[j].y < 0) {
						continue;
					}
					src.x = bullets[j].x;
					src.y = bullets[j].y;
					r = new Rectangle(bombBounds);
					if (bombDir != 0) r.x = WIDTH-bombBounds.x;
					if (src.intersects(r)) {
						bullets[j].y = -SPRITE_HEIGHT; // bullet disappears
						clearAllShells(9);
						bombScore = score+500;
						msg[0] = 0;
						msg[1] = 1000;
						bombBounds.x = -images.bomb.width;
					}
				}

				// animate heart
				if (heartBounds.y > -images.heart.height) {
					heartBounds.y++;
					if (beetleBounds.intersects(heartBounds)) { // collision with beetle
						pressMax = Math.max(0,pressMax-3);
						heartBounds.y = HEIGHT+images.heart.height;
						msg[0] = 1;
						msg[1] = 1000;
					}
					if (heartBounds.y >= HEIGHT+images.heart.height) {
						heartBounds.x = -images.heart.width;
						heartBounds.y = -images.heart.height;
					}
				}
			}

			// animTime applies to both shells and stars (both have 4 frames of animation)
			animTime+=delta;
			if (state == STATE_TITLE || state == STATE_SCORES) {
				while (animTime >= 200) {
					animFrame++;
					if (animFrame == 4) animFrame = 0;
					animTime-=200;
				}
			} else {
				while (animTime >= 50) {
					animFrame++;
					if (animFrame == 4) animFrame = 0;
					animTime-=50;
				}
			}

			// toggle FPS
			if (isKeyDown(keys.f)) {
				showFPS = !showFPS;
				keys[keys.f] = -1;
			}

			// spacebar pressed while squished
			if (state == STATE_GAME) {
				if (squished) {
					squishTime+=delta;
					if (isKeyDown(keys.spacebar)) {
						pressCount++;
						keys[keys.spacebar] = -1;
					}

					if (pressCount == pressMax) {
						squished = false;
						pressCount = 0;
						squishTime = 0;
						blinkTime = MAX_BLINK_TIME;			
					} else if (squishTime >= 5000) {
						state = STATE_GAME_OVER;
					}
				}
			} else if (state == STATE_TITLE) {
				if (isKeyDown(keys.spacebar)) {
					state = STATE_GAME;
					keys[keys.spacebar] = -1;
				}
			} else if (state == STATE_GAME_OVER) {
				if (isKeyDown(keys.r)) {
					keys[keys.r] = -1;
					reset();
					state = STATE_GAME;
				}
			} else if (state == STATE_SCORES || state == STATE_ERROR) {
				if (isKeyDown(keys.spacebar)) {
					keys[keys.spacebar] = -1;
					reset();
					state = STATE_GAME;
				}
			}

			if (state == STATE_GAME && squishTime >= 5000) {
				state = STATE_GAME_OVER;
			}
		}

		function render(ctx) {
			var j, w, secs, mins, str;

			ctx.fillStyle = BG;
			ctx.fillRect(0, 0, width, height);

			ctx.fillStyle = '#fff';
			for (j = scroll; j <= WIDTH; j += images.bg.width) {
				ctx.drawImage(images.bg, j, 0);
			}

			if (state == STATE_GAME) {
				if (bombBounds.x > -images.bomb.width) {
					ctx.drawImage(images.bomb, (!bombDir && bombBounds.x) || WIDTH-bombBounds.x, bombBounds.y - 59);
				}

				if (blinkTime <= 0 || blinkState == 0) {
					ctx.drawImage(images.beetle[beetleFrame + (squished && 2) || 0], beetleBounds.x, beetleBounds.y);
				}

				for (j = 0;j < numShells;j++) {
					drawShell(ctx, shells[j].x, shells[j].y, animFrame);
				}

				for (j = 0;j  < bullets.length;j++) {
					if (bullets[j].y > -SPRITE_HEIGHT) {
						ctx.drawImage(images.star[animFrame], bullets[j].x, bullets[j].y);
					}
				}

				for (j = 0;j < stars.length;j++) {
					if (stars[j].timeToLive > 0.0) {
						ctx.drawImage(images.star[4 + animFrame], stars[j].x, stars[j].y);
					}
				}

				secs = timeLeft / 1000;
				mins = Math.floor(secs / 60);
				secs = Math.floor(secs % 60);
				ctx.drawImage(images.timeLeft, 5, 5);
				drawTime(ctx, String(mins) + ':' + ((secs < 10 && '0' + String(secs)) || String(secs)), images.timeLeft.width + 10, 5);

				for (j = 0;j < points.length;j++) {
					if (points[j].life > 0) {
						drawText(ctx, String(points[j].score), points[j].x, points[j].y);
					}
				}

				drawScore(ctx);

				if (squished) {
					if (MAX_SQUISH_TIME - squishTime <= 3000 && MAX_SQUISH_TIME - squishTime > 0) {
						j = 2;
						if (MAX_SQUISH_TIME - squishTime <= 2000) {
							j = 1;
						}
						if (MAX_SQUISH_TIME - squishTime <= 1000) {
							j = 0;
						}

						ctx.drawImage(images.timer[j], beetleBounds.x, beetleBounds.y - beetleBounds.height - 12);
					}
				}

				ctx.drawImage(images.heart, heartBounds.x, heartBounds.y);

				// big message on screen ("nice!" / "great!" / "hp + 1")
				if (msg[1] > 0) {
					ctx.drawImage(
						images.messages[msg[0]],
						(WIDTH / 2) - (images.messages[msg[0]].width / 2),
						(HEIGHT / 2) - (images.messages[msg[0]].height / 2)
					);
				}
			} else if (state == STATE_TITLE) {
				ctx.drawImage(images.title, (WIDTH / 2) - (images.title.width / 2), 10);
				if (animFrame === 0 || animFrame === 1) {
					ctx.drawImage(images.space, (WIDTH / 2) - (images.space.width / 2), HEIGHT - images.space.height - 10);
				}
			} else if (state == STATE_GAME_OVER) {
				ctx.drawImage(images.gameOver, (WIDTH / 2) - (images.gameOver.width / 2), 10);
				drawText(ctx, 'Your Score: ' + score + '\n\n-Press -R- to restart game', 10, 150);
				ctx.drawImage(images.beetle[(squished && 2 || 0)], beetleBounds.x, beetleBounds.y);
			}

			if (showFPS) {
				drawText(ctx, fps, 5, HEIGHT - 16 - 5);
			}
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
		rw = rect.width;
		rh = rect.height;
		if (rw <= 0 || rh <= 0 || tw <= 0 || th <= 0) {
			return false;
		}
		tx = this.x;
		ty = this.y;
		rx = rect.x;
		ry = rect.y;
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
