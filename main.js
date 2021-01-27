'use strict';

const utils = require('@iobroker/adapter-core');
const axios = require('axios');
const adapterName = require('./package.json').name.split('.').pop();

let lastAlarmId = null;

class Divera247 extends utils.Adapter {

	constructor(options) {
		super({
			...options,
			name: adapterName,
		});
		this.on('ready', this.onReady.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	async onReady() {
		const diveraAccessKey = this.config.diveraAccessKey;
		const pollIntervallSeconds = this.config.pollIntervall;
		const pollIntervallMilliseconds = pollIntervallSeconds * 1000;
		const pollIntervallSecondsMinimum = 10;

		this.setState('info.connection', false, true);

		if (diveraAccessKey && pollIntervallSeconds) {
			if (pollIntervallSeconds >= pollIntervallSecondsMinimum) {
				if (await this.checkConnectionToApi(diveraAccessKey)) {
					// Connected to API
					this.setState('info.connection', true, true);

					// Creating the Object 'alarm' -> response JSON key 'success'
					this.setObjectNotExistsAsync('alarm', {
						type: 'state',
						common: {
							name: 'Alarm',
							type: 'boolean',
							role: 'indicator',
							read: true,
							write: false
						},
						native: {},
					});

					// Creating the Object 'title' -> response JSON key 'data.title'
					this.setObjectNotExistsAsync('title', {
						type: 'state',
						common: {
							name: 'Einsatzstichwort',
							type: 'string',
							role: 'text',
							read: true,
							write: false
						},
						native: {},
					});

					// Creating the Object 'title' -> response JSON key 'data.title'
					this.setObjectNotExistsAsync('text', {
						type: 'state',
						common: {
							name: 'Meldungstext',
							type: 'string',
							role: 'text',
							read: true,
							write: false
						},
						native: {},
					});

					// Creating the Object 'address' -> response JSON key 'data.address'
					this.setObjectNotExistsAsync('address', {
						type: 'state',
						common: {
							name: 'Adresse',
							type: 'string',
							role: 'text',
							read: true,
							write: false
						},
						native: {},
					});

					// Creating the Object 'lat' -> response JSON key 'data.lat'
					this.setObjectNotExistsAsync('lat', {
						type: 'state',
						common: {
							name: 'Längengrad',
							type: 'number',
							role: 'text',
							read: true,
							write: false
						},
						native: {},
					});

					// Creating the Object 'lng' -> response JSON key 'data.lng'
					this.setObjectNotExistsAsync('lng', {
						type: 'state',
						common: {
							name: 'Breitengrad',
							type: 'number',
							role: 'text',
							read: true,
							write: false
						},
						native: {},
					});

					// Creating the Object 'date' -> response JSON key 'data.date'
					this.setObjectNotExistsAsync('date', {
						type: 'state',
						common: {
							name: 'Alarmierungszeit',
							type: 'number',
							role: 'date',
							read: true,
							write: false
						},
						native: {},
					});

					// Creating the Object 'lastUpdate' -> current timestamp
					this.setObjectNotExistsAsync('lastUpdate', {
						type: 'state',
						common: {
							name: 'Letzte Aktualisierung',
							type: 'number',
							role: 'value.time',
							read: true,
							write: false
						},
						native: {},
					});

					// Initialisation of the states
					this.setState('title', { val: null, ack: true });
					this.setState('text', { val: null, ack: true });
					this.setState('address', { val: null, ack: true });
					this.setState('lat', { val: null, ack: true });
					this.setState('lng', { val: null, ack: true });
					this.setState('date', { val: null, ack: true });

					// Registration of an interval calling the main function for this adapter
					let repeatingFunctionCall = setInterval(() => {
						this.getDataFromApiAndSetObjects(diveraAccessKey);
					}, pollIntervallMilliseconds);
				}
			} else {
				this.log.error('The update interval must be at least ' + pollIntervallSecondsMinimum + ' seconds!');
			}
		}
	}

	/*
	*	Function to check the connection to the API
	*	returns true / false
	*/
	checkConnectionToApi(diveraAccessKey) {
		// Calling the alerting-server api
		return axios({
			method: 'get',
			baseURL: 'https://www.divera247.com/',
			url: '/api/last-alarm?accesskey=' + diveraAccessKey,
			responseType: 'json'
		}).then(
			function (response) {
				if (response.data.status == 200) {
					this.log.debug('Connection to API succeeded');
					return true;
				} else {
					this.log.warn('Connection to API failed. Please check your API-Key and try again');
					return false;
				}
			}.bind(this)
		).catch(
			function (error) {
				if (error.response) {
					// The request was made and the server responded with a error status code
					if (error.response.status == 403) {
						this.log.error('Access-Token invalid. Please use a valid token!');
						return false;
					} else {
						this.log.warn('received error ' + error.response.status + ' response with content: ' + JSON.stringify(error.response.data));
						return false;
					}
				} else if (error.request) {
					// The request was made but no response was received
					this.log.error(error.message);
					return false;
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.error(error.message);
					return false;
				}
			}.bind(this)
		)
	}

	/*
	*	Function that calls the API and set the Object States
	*/
	getDataFromApiAndSetObjects(diveraAccessKey) {
		// Calling the alerting-server api
		axios({
			method: 'get',
			baseURL: 'https://www.divera247.com/',
			url: '/api/last-alarm?accesskey=' + diveraAccessKey,
			responseType: 'json'
		}).then(
			function (response) {
				const content = response.data;

				this.log.debug('Received data from Divera-API (' + response.status + '): ' + JSON.stringify(content));

				// Setting the states
				this.setState('alarm', { val: content.success, ack: true });
				this.setState('lastUpdate', { val: Date.now(), ack: true });
				// Setting the alarm specific states when a alarm is active and the alarm id is different to the last id
				if (content.success && lastAlarmId != content.data.id) {
					lastAlarmId = content.data.id;
					this.setState('title', { val: content.data.title, ack: true });
					this.setState('text', { val: content.data.text, ack: true });
					this.setState('address', { val: content.data.address, ack: true });
					this.setState('lat', { val: content.data.lat, ack: true });
					this.setState('lng', { val: content.data.lng, ack: true });
					this.setState('date', { val: content.data.date * 1000, ack: true });
				}
			}.bind(this)
		).catch(
			function (error) {
				if (error.response) {
					// The request was made and the server responded with a error status code
					if (error.response.status == 403) {
						this.log.error('Access-Token has been invalid. Please use a valid token!');
						this.setState('info.connection', false, true);
					} else {
						this.log.warn('received error ' + error.response.status + ' response with content: ' + JSON.stringify(error.response.data));
						this.setState('info.connection', false, true);
					}
				} else if (error.request) {
					// The request was made but no response was received
					this.log.error(error.message);
					this.setState('info.connection', false, true);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.error(error.message);
					this.setState('info.connection', false, true);
				}
			}.bind(this)
		)
	}

	// Is called when adapter shuts down
	onUnload(callback) {
		try {
			clearInterval(repeatingFunctionCall);
			callback();
		} catch (e) {
			callback();
		}
	}
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Divera247(options);
} else {
	// otherwise start the instance directly
	new Divera247();
}