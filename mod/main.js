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
		/** @type {string} Loaded Options menu HTML template. */
		this.optionsTemplate = '';
		/** @type {number|null} Pending layout refresh animation frame. */
		this.resizeFrame = null;

		/** @type {UIScalerHandlers} */
		this.handlers = {
			draw: this.handleDraw.bind(this),
			keydown: this.handleKeyDown.bind(this),
			templateReadyState: this.handleTemplateReadyState.bind(this),
			sliderInput: this.handleSliderInput.bind(this),
			sliderMouseUp: this.handleSliderMouseUp.bind(this),
			decreaseClick: this.handleDecreaseClick.bind(this),
			resetClick: this.handleResetClick.bind(this),
			increaseClick: this.handleIncreaseClick.bind(this)
		};
	}

	/** @returns {void} */
	init() {
		this.applyScale();
		this.loadOptionsTemplate();
		this.registerEventListeners();
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
		this.addOptionsUI();
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

		if (persist) Game.toSave = true;
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
		return JSON.stringify({ scale: this.scale });
	}

	/**
	 * @param {string} savedData
	 * @returns {void}
	 */
	load(savedData) {
		try {
			const scale = JSON.parse(savedData)?.scale ?? this.defaultScale;
			this.setScale(scale, false);
		}
		catch {
			this.setScale(this.defaultScale, false);
		}
	}
}

Game.registerMod('UI_Scaler', new UIScaler());
