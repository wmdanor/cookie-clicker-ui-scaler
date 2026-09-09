/**
 * @typedef {Object} UIScalerHandlers
 * @property {() => void} draw
 * @property {(event: KeyboardEvent) => void} keydown
 * @property {(event: Event) => void} templateReadyState
 * @property {(event: Event) => void} sliderInput
 * @property {() => void} sliderMouseUp
 * @property {(event: MouseEvent) => void} decreaseClick
 * @property {(event: MouseEvent) => void} resetClick
 * @property {(event: MouseEvent) => void} increaseClick
 * @property {(event: MouseEvent) => void} marketGraphMouseMove
 * @property {(event: MouseEvent) => void} buildingCanvasMouseMove
 */

/**
 * @typedef {Object} CookieClickerTooltip
 * @property {string} origin
 * @property {HTMLElement|0} from
 * @property {() => void} hide
 * @property {(...args: unknown[]) => unknown} update
 */

class UIScaler {
	constructor() {
		/** @type {string} Directory injected by Cookie Clicker's Steam bridge. */
		this.dir = '';
		/** @type {number} Default UI scale percentage. */
		this.defaultScale = 100;
		/** @type {number} Current UI scale percentage. */
		this.scale = this.defaultScale;
		/** @type {number} Lowest selectable scale percentage. */
		this.minScale = 50;
		/** @type {number} Highest selectable scale percentage. */
		this.maxScale = 300;
		/** @type {number} Scale adjustment size in percentage points. */
		this.step = 25;
		/** @type {string} Machine-local storage key. */
		this.storageKey = 'UI_Scaler.scale';
		/** @type {string} Loaded Options menu HTML template. */
		this.optionsTemplate = '';
		/** @type {number|null} Pending layout refresh animation frame. */
		this.resizeFrame = null;
		/** @type {boolean} Whether the tooltip position fix is installed. */
		this.tooltipPositionFixInstalled = false;
		/** @type {boolean} Whether the prompt position fix is installed. */
		this.promptPositionFixInstalled = false;
		/** @type {boolean} Whether the visual effect position fix is installed. */
		this.visualEffectPositionFixInstalled = false;
		/** @type {WeakSet<HTMLCanvasElement>} Stock Market graphs with corrected pointer coordinates. */
		this.positionFixedMarketGraphs = new WeakSet();
		/** @type {WeakSet<object>} Garden minigames with corrected draw coordinates. */
		this.positionFixedGardens = new WeakSet();
		/** @type {WeakSet<object>} Pantheon minigames with corrected draw coordinates. */
		this.positionFixedPantheons = new WeakSet();
		/** @type {WeakSet<HTMLCanvasElement>} Building canvases with corrected hover coordinates. */
		this.positionFixedBuildingCanvases = new WeakSet();
		/** @type {WeakMap<HTMLCanvasElement, {mousePos: number[]}>} Building associated with each canvas. */
		this.buildingsByCanvas = new WeakMap();

		/** @type {UIScalerHandlers} */
		this.handlers = {
			draw: this.handleDraw.bind(this),
			keydown: this.handleKeyDown.bind(this),
			templateReadyState: this.handleTemplateReadyState.bind(this),
			sliderInput: this.handleSliderInput.bind(this),
			sliderMouseUp: this.handleSliderMouseUp.bind(this),
			decreaseClick: this.handleDecreaseClick.bind(this),
			resetClick: this.handleResetClick.bind(this),
			increaseClick: this.handleIncreaseClick.bind(this),
			marketGraphMouseMove: this.handleMarketGraphMouseMove.bind(this),
			buildingCanvasMouseMove: this.handleBuildingCanvasMouseMove.bind(this)
		};
	}

	/** @returns {void} */
	init() {
		this.scale = this.readLocalScale();
		this.applyScale();
		this.installTooltipPositionFix();
		this.installPromptPositionFix();
		this.installVisualEffectPositionFix();
		this.installBuildingCanvasPositionFixes();
		this.installLoadedMinigamePositionFixes();
		this.stabilizeLegacyTooltipPainting();
		this.clearPositionDiagnostics();
		this.loadOptionsTemplate();
		this.registerEventListeners();
	}

	/** @returns {void} */
	installTooltipPositionFix() {
		if (this.tooltipPositionFixInstalled) return;

		const originalUpdate = Game.tooltip.update;

		Game.tooltip.update = (...args) => {
			return this.updateTooltipWithLogicalCoordinates(originalUpdate, args);
		};

		this.tooltipPositionFixInstalled = true;
	}

	/**
	 * Mouse-positioned tooltips use viewport coordinates, while store tooltips
	 * also use the viewport width. Temporarily convert those values into the
	 * body's logical coordinate space while Cookie Clicker positions the tooltip.
	 *
	 * @param {(...args: unknown[]) => unknown} originalUpdate
	 * @param {unknown[]} args
	 * @returns {unknown}
	 */
	updateTooltipWithLogicalCoordinates(originalUpdate, args) {
		const tooltip = /** @type {CookieClickerTooltip} */ (Game.tooltip);
		if (!this.normalizeTooltipSource(tooltip)) return false;

		const zoom = this.scale / 100;
		const usesMousePosition = !Game.onCrate && !(tooltip.origin === 'this' && tooltip.from);

		if (zoom === 1 || (!usesMousePosition && tooltip.origin !== 'store')) {
			return originalUpdate.apply(Game.tooltip, args);
		}

		const coordinates = {
			windowW: Game.windowW,
			windowH: Game.windowH,
			mouseX: Game.mouseX,
			mouseY: Game.mouseY
		};

		if (tooltip.origin === 'store' || usesMousePosition) Game.windowW /= zoom;
		if (usesMousePosition) {
			Game.windowH /= zoom;
			Game.mouseX /= zoom;
			Game.mouseY /= zoom;
		}

		try {
			return originalUpdate.apply(Game.tooltip, args);
		}
		finally {
			Game.windowW = coordinates.windowW;
			Game.windowH = coordinates.windowH;
			Game.mouseX = coordinates.mouseX;
			Game.mouseY = coordinates.mouseY;
		}
	}

	/**
	 * Cookie Clicker may retain Game.onCrate when a menu rebuild removes the
	 * hovered crate without firing mouseout. That stale reference overrides the
	 * next tooltip's requested origin and can leave it at an old position.
	 *
	 * @param {CookieClickerTooltip} tooltip
	 * @returns {boolean} Whether the tooltip still has a valid source.
	 */
	normalizeTooltipSource(tooltip) {
		if (tooltip.from && !tooltip.from.isConnected) {
			Game.setOnCrate(0);
			tooltip.hide();
			return false;
		}

		if (Game.onCrate && (Game.onCrate !== tooltip.from || !Game.onCrate.isConnected)) {
			Game.setOnCrate(0);
		}

		return true;
	}

	/**
	 * The Legacy tooltip is rebuilt twice per second while visible. Isolating it
	 * in a compositing layer avoids partial repaints under body CSS zoom.
	 *
	 * @returns {void}
	 */
	stabilizeLegacyTooltipPainting() {
		const tooltip = /** @type {HTMLElement|null} */ (l('ascendTooltip'));
		if (!tooltip) return;

		tooltip.style.transform = 'translateZ(0)';
		tooltip.style.backfaceVisibility = 'hidden';
		tooltip.style.webkitBackfaceVisibility = 'hidden';
	}

	/** @returns {void} */
	installPromptPositionFix() {
		if (this.promptPositionFixInstalled) return;

		const originalUpdate = Game.UpdatePrompt;

		Game.UpdatePrompt = (...args) => {
			const result = originalUpdate.apply(Game, args);
			this.correctPromptPosition();

			return result;
		};

		this.promptPositionFixInstalled = true;
	}

	/** @returns {void} */
	correctPromptPosition() {
		const zoom = this.scale / 100;
		if (zoom === 1) return;

		const currentTop = Number.parseFloat(Game.promptAnchorL.style.top);
		if (!Number.isFinite(currentTop)) return;

		const viewportCorrection = (Game.windowH / zoom - Game.windowH) / 2;
		Game.promptAnchorL.style.top = `${currentTop + viewportCorrection}px`;
	}

	/** @returns {void} */
	installVisualEffectPositionFix() {
		if (this.visualEffectPositionFixInstalled) return;

		const originalPopup = Game.Popup;
		const originalSparkleAt = Game.SparkleAt;
		const originalParticleAdd = Game.particleAdd;

		Game.Popup = (text, x, y) => {
			if (!this.isCurrentMousePosition(x, y)) return originalPopup.call(Game, text, x, y);

			[x, y] = this.toLogicalMousePosition(x, y);

			return this.withLogicalGameBounds(() => originalPopup.call(Game, text, x, y));
		};

		Game.SparkleAt = (x, y) => {
			if (this.isCurrentMousePosition(x, y)) [x, y] = this.toLogicalMousePosition(x, y);
			return originalSparkleAt.call(Game, x, y);
		};

		Game.particleAdd = (x, y, xd, yd, size, duration, layer, picture, text) => {
			if (this.isMouseAnchoredParticle(x, y, text)) {
				[x, y] = this.toLogicalMousePosition(x, y);
			}

			return originalParticleAdd.call(
				Game,
				x,
				y,
				xd,
				yd,
				size,
				duration,
				layer,
				picture,
				text
			);
		};

		this.visualEffectPositionFixInstalled = true;
	}

	/**
	 * @param {number|undefined} x
	 * @param {number|undefined} y
	 * @returns {boolean}
	 */
	isCurrentMousePosition(x, y) {
		return x === Game.mouseX && y === Game.mouseY;
	}

	/**
	 * Cookie click numbers and the dragon pet effect include intentional offsets
	 * around the mouse.
	 *
	 * @param {number|undefined} x
	 * @param {number|undefined} y
	 * @param {string|0|undefined} text
	 * @returns {boolean}
	 */
	isMouseAnchoredParticle(x, y, text) {
		if (this.isCurrentMousePosition(x, y)) return true;
		if (x === undefined || y === undefined) return false;

		const offsetX = x - Game.mouseX;
		const offsetY = y - Game.mouseY;
		const isDragonPetParticle = offsetX === 0 && offsetY === -32;
		const isCookieClickNumber = Boolean(text) && Math.abs(offsetX) <= 4 && offsetY >= -12 && offsetY <= -4;

		return isDragonPetParticle || isCookieClickNumber;
	}

	/**
	 * Preserve any intentional local offset while converting the mouse anchor.
	 *
	 * @param {number} x
	 * @param {number} y
	 * @returns {[number, number]}
	 */
	toLogicalMousePosition(x, y) {
		const zoom = this.scale / 100;
		const offsetX = x - Game.mouseX;
		const offsetY = y - Game.mouseY;

		return [Game.mouseX / zoom + offsetX, Game.mouseY / zoom + offsetY];
	}

	/**
	 * Game.Popup clamps explicit positions to Game.bounds. Temporarily convert
	 * those bounds along with the mouse position supplied to the popup.
	 *
	 * @param {() => unknown} callback
	 * @returns {unknown}
	 */
	withLogicalGameBounds(callback) {
		const zoom = this.scale / 100;
		if (zoom === 1 || !Game.bounds) return callback();

		const originalBounds = Game.bounds;
		const properties = ['x', 'y', 'width', 'height', 'top', 'right', 'bottom', 'left'];
		/** @type {Record<string, number>} */
		const logicalBounds = {};

		for (const property of properties) {
			const value = originalBounds[property];
			if (typeof value !== 'number') continue;

			logicalBounds[property] = value / zoom;
		}

		Game.bounds = logicalBounds;

		try {
			return callback();
		}
		finally {
			Game.bounds = originalBounds;
		}
	}

	/** @returns {number} */
	readLocalScale() {
		try {
			const storedScale = window.localStorage.getItem(this.storageKey);
			return storedScale === null ? this.defaultScale : this.clampScale(storedScale);
		}
		catch {
			return this.defaultScale;
		}
	}

	/** @returns {void} */
	writeLocalScale() {
		try {
			window.localStorage.setItem(this.storageKey, String(this.scale));
		}
		catch {
			console.error('UI Scaler could not save its local setting.');
		}
	}

	/** @returns {void} */
	loadOptionsTemplate() {
		const request = new XMLHttpRequest();

		request.addEventListener('readystatechange', this.handlers.templateReadyState);
		request.open('GET', `${this.dir}/options.html`, true);
		request.send();
	}

	/**
	 * @param {Event} event
	 * @returns {void}
	 */
	handleTemplateReadyState(event) {
		const request = /** @type {XMLHttpRequest} */ (event.currentTarget);
		if (request.readyState !== XMLHttpRequest.DONE) return;

		// Local files use status 0 in some Electron versions.
		if ((request.status === 200 || request.status === 0) && request.responseText) {
			this.optionsTemplate = request.responseText;
			return;
		}

		console.error('UI Scaler could not load options.html.');
	}

	/** @returns {void} */
	registerEventListeners() {
		Game.registerHook('draw', this.handlers.draw);
		document.addEventListener('keydown', this.handlers.keydown, true);
	}

	/** @returns {void} */
	handleDraw() {
		this.installLoadedMinigamePositionFixes();
		this.addOptionsUI();
	}

	/** @returns {void} */
	installLoadedMinigamePositionFixes() {
		const farm = Game.Objects['Farm'];
		const temple = Game.Objects['Temple'];
		const bank = Game.Objects['Bank'];

		if (farm.minigame) this.installGardenPositionFix(farm.minigame);
		if (temple.minigame) this.installPantheonPositionFix(temple.minigame);
		if (bank.minigame && bank.minigame.graph) this.installMarketGraphPositionFix(bank.minigame.graph);
	}

	/** @returns {void} */
	installBuildingCanvasPositionFixes() {
		this.installBuildingCanvasPositionFix(Game.Objects['Grandma']);
		this.installBuildingCanvasPositionFix(Game.Objects['You']);
	}

	/**
	 * Cookie Clicker's listener mixes page coordinates with element bounds. Add a
	 * later listener that uses coordinates local to the canvas instead.
	 *
	 * @param {{canvas: HTMLCanvasElement, mousePos: number[]}|undefined} building
	 * @returns {void}
	 */
	installBuildingCanvasPositionFix(building) {
		if (!building || this.positionFixedBuildingCanvases.has(building.canvas)) return;

		this.buildingsByCanvas.set(building.canvas, building);
		building.canvas.addEventListener('mousemove', this.handlers.buildingCanvasMouseMove);
		this.positionFixedBuildingCanvases.add(building.canvas);
	}

	/**
	 * @param {MouseEvent} event
	 * @returns {void}
	 */
	handleBuildingCanvasMouseMove(event) {
		const canvas = /** @type {HTMLCanvasElement} */ (event.currentTarget);
		const building = this.buildingsByCanvas.get(canvas);
		if (!building) return;

		const zoom = this.scale / 100;
		building.mousePos[0] = event.layerX / zoom;
		building.mousePos[1] = event.layerY / zoom;
	}

	/**
	 * @param {{draw: (...args: unknown[]) => unknown}} garden
	 * @returns {void}
	 */
	installGardenPositionFix(garden) {
		if (this.positionFixedGardens.has(garden)) return;

		const uiScaler = this;
		const originalDraw = garden.draw;
		garden.draw = function (...args) {
			return uiScaler.withLogicalMouseCoordinates(() => originalDraw.apply(this, args));
		};
		this.positionFixedGardens.add(garden);
	}

	/**
	 * @param {{draw: (...args: unknown[]) => unknown}} pantheon
	 * @returns {void}
	 */
	installPantheonPositionFix(pantheon) {
		if (this.positionFixedPantheons.has(pantheon)) return;

		const uiScaler = this;
		const originalDraw = pantheon.draw;
		pantheon.draw = function (...args) {
			return uiScaler.withLogicalMouseCoordinates(() => originalDraw.apply(this, args));
		};
		this.positionFixedPantheons.add(pantheon);
	}

	/**
	 * @param {() => unknown} callback
	 * @returns {unknown}
	 */
	withLogicalMouseCoordinates(callback) {
		const zoom = this.scale / 100;
		if (zoom === 1) return callback();

		const originalMouseX = Game.mouseX;
		const originalMouseY = Game.mouseY;
		Game.mouseX /= zoom;
		Game.mouseY /= zoom;

		try {
			return callback();
		}
		finally {
			Game.mouseX = originalMouseX;
			Game.mouseY = originalMouseY;
		}
	}

	/**
	 * @param {HTMLCanvasElement} graph
	 * @returns {void}
	 */
	installMarketGraphPositionFix(graph) {
		if (this.positionFixedMarketGraphs.has(graph)) return;

		// Cookie Clicker's listener runs first; this corrects its result afterward.
		graph.addEventListener('mousemove', this.handlers.marketGraphMouseMove);
		this.positionFixedMarketGraphs.add(graph);
	}

	/**
	 * Convert viewport pointer coordinates to the Stock Market canvas coordinate
	 * space before Cookie Clicker's graph hover listener reads layerX/layerY.
	 *
	 * @param {MouseEvent} event
	 * @returns {void}
	 */
	handleMarketGraphMouseMove(event) {
		if (this.scale === 100) return;

		const graph = /** @type {HTMLCanvasElement} */ (event.currentTarget);
		const stockMarket = Game.Objects['Bank'].minigame;
		const zoom = this.scale / 100;
		const layerX = event.layerX / zoom;
		const layerY = event.layerY / zoom;
		const span = Math.max(4, Math.ceil(graph.width / 65));
		const rows = Math.ceil(graph.width / span);
		let hoveredGood = -1;

		marketGraphMouseDetect:
		for (let goodIndex = stockMarket.goodsById.length - 1; goodIndex >= 0; goodIndex--) {
			const good = stockMarket.goodsById[goodIndex];
			if (good.hidden || !good.active) continue;

			for (let row = 0; row < rows; row++) {
				if (good.vals.length < 2 + row) continue;

				const value = Math.max(good.vals[row], good.vals[row + 1]);
				const change = Math.abs(good.vals[row] - good.vals[row + 1]);
				const lineX = graph.width - span * row;
				const lineY = graph.height - value * stockMarket.graphScale;
				const lineHeight = Math.max(3, change * stockMarket.graphScale);

				if (
					layerX >= lineX - span - 2 &&
					layerX <= lineX + 2 &&
					layerY >= lineY - 6 &&
					layerY <= lineY + lineHeight + 6
				) {
					hoveredGood = goodIndex;
					Game.tooltip.draw(
						0,
						'<div style="width:128px;font-size:10px;text-align:center;" id="tooltipMarketLine">' +
						'<div class="icon" style="pointer-events:none;display:inline-block;transform:scale(0.5);' +
						'margin:-16px -18px -16px -14px;vertical-align:middle;background-position:' +
						`${-good.icon[0] * 48}px ${-good.icon[1] * 48}px;"></div> <b>` +
						good.name.replace('%1', Game.bakeryName) + '</b><br>' +
						loc('valued at %1', `<b>$${Beautify(good.vals[row], 2)}</b>`) + '<br>' +
						loc('%1 ago', Game.sayTime((row + 1) * stockMarket.secondsPerTick * Game.fps)) +
						'</div>',
						'top'
					);
					break marketGraphMouseDetect;
				}
			}
		}

		if (hoveredGood === stockMarket.hoverOnGood) return;

		stockMarket.hoverOnGood = hoveredGood;
		stockMarket.toRedraw = 2;
		if (hoveredGood !== -1) {
			graph.style.cursor = 'pointer';
		}
		else {
			graph.style.cursor = 'auto';
			Game.tooltip.shouldHide = 1;
		}
	}

	/** @returns {void} */
	clearPositionDiagnostics() {
		try {
			window.localStorage.removeItem('UI_Scaler.positionDiagnostics');
		}
		catch {}
	}

	/**
	 * @param {KeyboardEvent} event
	 * @returns {void}
	 */
	handleKeyDown(event) {
		if (!event.ctrlKey || this.isTypingTarget(event.target)) return;

		if (this.isIncreaseShortcut(event)) this.changeScale(this.step);
		else if (this.isDecreaseShortcut(event)) this.changeScale(-this.step);
		else if (this.isResetShortcut(event)) this.setScale(this.defaultScale);
		else return;

		event.preventDefault();
		event.stopPropagation();
	}

	/**
	 * @param {EventTarget|null} target
	 * @returns {boolean}
	 */
	isTypingTarget(target) {
		const element = /** @type {HTMLElement|null} */ (target);

		return Boolean(element && (
			element.tagName === 'INPUT' ||
			element.tagName === 'TEXTAREA' ||
			element.tagName === 'SELECT' ||
			element.isContentEditable
		));
	}

	/**
	 * @param {KeyboardEvent} event
	 * @returns {boolean}
	 */
	isIncreaseShortcut(event) {
		return event.key === '+' || event.key === '=' || event.code === 'NumpadAdd';
	}

	/**
	 * @param {KeyboardEvent} event
	 * @returns {boolean}
	 */
	isDecreaseShortcut(event) {
		return event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract';
	}

	/**
	 * @param {KeyboardEvent} event
	 * @returns {boolean}
	 */
	isResetShortcut(event) {
		return event.key === '0' || event.code === 'Numpad0';
	}

	/**
	 * @param {Event} event
	 * @returns {void}
	 */
	handleSliderInput(event) {
		const slider = /** @type {HTMLInputElement} */ (event.target);
		this.setScale(Number(slider.value));
	}

	/** @returns {void} */
	handleSliderMouseUp() {
		PlaySound('snd/tick.mp3');
	}

	/**
	 * @param {MouseEvent} event
	 * @returns {void}
	 */
	handleDecreaseClick(event) {
		event.preventDefault();
		this.changeScale(-this.step);
		PlaySound('snd/tick.mp3');
	}

	/**
	 * @param {MouseEvent} event
	 * @returns {void}
	 */
	handleResetClick(event) {
		event.preventDefault();
		this.setScale(this.defaultScale);
		PlaySound('snd/tick.mp3');
	}

	/**
	 * @param {MouseEvent} event
	 * @returns {void}
	 */
	handleIncreaseClick(event) {
		event.preventDefault();
		this.changeScale(this.step);
		PlaySound('snd/tick.mp3');
	}

	/**
	 * @param {number|string} value
	 * @returns {number}
	 */
	clampScale(value) {
		const numericValue = Number(value);
		const validValue = Number.isFinite(numericValue) ? numericValue : this.defaultScale;
		const steppedValue = Math.round(validValue / this.step) * this.step;

		return Math.max(this.minScale, Math.min(this.maxScale, steppedValue));
	}

	/** @returns {void} */
	applyScale() {
		document.body.style.zoom = `${this.scale}%`;

		if (this.resizeFrame !== null) cancelAnimationFrame(this.resizeFrame);

		this.resizeFrame = requestAnimationFrame(() => {
			this.resizeFrame = null;
			window.dispatchEvent(new Event('resize'));
		});
	}

	/**
	 * @param {number|string} value
	 * @param {boolean} [persist=true]
	 * @returns {void}
	 */
	setScale(value, persist = true) {
		this.scale = this.clampScale(value);
		this.applyScale();
		this.updateOptionsUI();

		if (persist) this.writeLocalScale();
	}

	/**
	 * @param {number} amount
	 * @returns {void}
	 */
	changeScale(amount) {
		this.setScale(this.scale + amount);
	}

	/** @returns {void} */
	updateOptionsUI() {
		const slider = /** @type {HTMLInputElement|null} */ (l('uiScaleSlider'));
		const value = /** @type {HTMLElement|null} */ (l('uiScaleSliderRightText'));

		if (slider) slider.value = String(this.scale);
		if (value) value.textContent = `${this.scale}%`;
	}

	/** @returns {void} */
	addOptionsUI() {
		if (Game.onMenu !== 'prefs' || !this.optionsTemplate || l('uiScaleModOptions')) return;

		const menu = /** @type {HTMLElement|null} */ (l('menu'));
		if (!menu) return;

		const optionsHeading = menu.querySelector('.section');
		if (!optionsHeading) return;

		optionsHeading.insertAdjacentHTML('afterend', this.renderOptionsTemplate());
		this.registerOptionsEventListeners();
	}

	/** @returns {string} */
	renderOptionsTemplate() {
		/** @type {Record<string, number>} */
		const replacements = {
			'{{scale}}': this.scale,
			'{{defaultScale}}': this.defaultScale,
			'{{minScale}}': this.minScale,
			'{{maxScale}}': this.maxScale,
			'{{step}}': this.step
		};

		return Object.entries(replacements).reduce(
			(html, [placeholder, value]) => html.split(placeholder).join(String(value)),
			this.optionsTemplate
		);
	}

	/** @returns {void} */
	registerOptionsEventListeners() {
		const slider = /** @type {HTMLInputElement} */ (l('uiScaleSlider'));
		const decrease = /** @type {HTMLElement} */ (l('uiScaleDecrease'));
		const reset = /** @type {HTMLElement} */ (l('uiScaleReset'));
		const increase = /** @type {HTMLElement} */ (l('uiScaleIncrease'));

		slider.addEventListener('input', this.handlers.sliderInput);
		slider.addEventListener('mouseup', this.handlers.sliderMouseUp);
		decrease.addEventListener('click', this.handlers.decreaseClick);
		reset.addEventListener('click', this.handlers.resetClick);
		increase.addEventListener('click', this.handlers.increaseClick);
	}

	/** @returns {string} */
	save() {
		return '';
	}

	/** @returns {void} */
	load() {}
}

Game.registerMod('UI_Scaler', new UIScaler());
