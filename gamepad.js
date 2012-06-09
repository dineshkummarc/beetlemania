(function (window) {
	"use strict";
	var events = ['buttonpressed', 'buttonreleased', 'axismoved'];

	function createArray(length, defaultValue) {
		var j, result = [];

		for (j = 0; j < length; j += 1) {
			result.push(defaultValue);
		}

		return result;
	}

	function validateEventName(eventName) {
		return events.filter(function (name) {
			return eventName.toLowerCase() === name;
		}).length > 0;
	}

	function getGamepad(index) {
		if (typeof window.navigator.webkitGamepads === 'undefined') {
			throw new Error('Gamepad support not found');
		}

		return window.navigator.webkitGamepads[index];
	}

	function getGamepadState(gamepadIndex) {
		var gamepad = getGamepad(gamepadIndex);

		return ({
			buttons: gamepad.buttons,
			axes: gamepad.axes.map(function (axisValue) {
				return +(axisValue).toFixed(1);
			})
		});
	}

	function computeStateDiff(oldState, newState) {
		var diff = {
			buttons: createArray(oldState.buttons.length, 0),
			axes: createArray(oldState.axes.length, 0)
		};

		newState.buttons.forEach(function (buttonValue, buttonId) {
			if (oldState.buttons[buttonId] !== buttonValue) {
				diff.buttons[buttonId] = +(buttonValue - oldState.buttons[buttonId]).toFixed(1);
			}
		});

		newState.axes.forEach(function (axisValue, axisId) {
			if (oldState.axes[axisId] !== axisValue) {
				diff.axes[axisId] = axisValue - oldState.axes[axisId];
			}
		});

		return diff;
	}

	function triggerEvent(gamepadInstance, eventData) {
		gamepadInstance.listeners[eventData.type].every(function (listener) {
			return listener.call(gamepadInstance, eventData) !== false;
		});
	}

	function triggerDiffEvents(gamepadInstance, diff) {
		diff.buttons.forEach(function (diffValue, buttonId) {
			if (diffValue !== 0) {
				triggerEvent(gamepadInstance, {
					type: 'button' + ((diffValue < 0 && 'released') || 'pressed'),
					buttonId: buttonId,
					currentValue: gamepadInstance.state.buttons[buttonId],
					diffValue: diffValue
				});
			}
		});

		diff.axes.forEach(function (diffValue, axisId) {
			if (diffValue !== 0) {
				triggerEvent(gamepadInstance, {
					type: 'axismoved',
					axisId: axisId,
					currentValue: gamepadInstance.state.axes[axisId],
					diffValue: diffValue
				});
			}
		});
	}

	function pollDevice(gamepadInstance, freq) {
		var newState, diff;
		newState = getGamepadState(gamepadInstance.index);
		diff = computeStateDiff(gamepadInstance.state, newState);
		gamepadInstance.state = newState;
		triggerDiffEvents(gamepadInstance, diff);

		window.setTimeout(pollDevice, freq, gamepadInstance, freq);
	}

	function Gamepad(gamepadIndex, pollFreq) {
		var self = this;

		this.index = gamepadIndex || 0;

		if (!getGamepad(this.index)) {
			throw new Error('Could not find gamepad at index ' + this.index);
		}

		this.state = getGamepadState(this.index);

		this.listeners = {};
		events.forEach(function (eventName) {
			self.listeners[eventName.toLowerCase()] = [];
		});

		pollDevice(this, pollFreq || 50);
	}

	Gamepad.prototype.on = function (eventName, callback) {
		if (typeof eventName !== 'string') {
			throw new Error('eventName parameter must be a string');
		}

		if (typeof callback !== 'function') {
			throw new Error('Callback parameter must be a function');
		}

		if (!validateEventName(eventName)) {
			throw new Error('Unrecognized eventName: ' + eventName);
		}

		this.listeners[eventName].push(callback);
	};

	window.Gamepad = Gamepad;
}(this));
