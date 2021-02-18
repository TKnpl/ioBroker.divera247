'use strict';

const utils = require('@iobroker/adapter-core');
const axios = require('axios');
const adapterName = require('./package.json').name.split('.').pop();

let lastAlarmId = null;
let lastAlarmStatus = false;

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
		const diveraUserId = this.config.diveraUserId;
		const pollIntervallSeconds = this.config.pollIntervall;
		const pollIntervallMilliseconds = pollIntervallSeconds * 1000;
		const pollIntervallSecondsMinimum = 10;

		this.setState('info.connection', false, true);

		if (diveraAccessKey && diveraUserId && pollIntervallSeconds) {
			if (diveraUserId > 0) {
				if (pollIntervallSeconds >= pollIntervallSecondsMinimum) {
					if (await this.checkConnectionToApi(diveraAccessKey)) {
						// Connected to API
						this.setState('info.connection', true, true);

						
							// Creating the Object 'alarm' -> response JSON key 'success'
							await this.setObjectNotExistsAsync('alarm', {
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
							await this.setObjectNotExistsAsync('title', {
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
							await this.setObjectNotExistsAsync('text', {
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

							// Creating the Object 'foreign_id' -> response JSON key 'data.foreign_id'
							await this.setObjectNotExistsAsync('foreign_id', {
								type: 'state',
								common: {
									name: 'Einsatznummer',
									type: 'number',
									role: 'text',
									read: true,
									write: false
								},
								native: {},
							});
		
							// Creating the Object 'address' -> response JSON key 'data.address'
							await this.setObjectNotExistsAsync('address', {
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
							await this.setObjectNotExistsAsync('lat', {
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
							await this.setObjectNotExistsAsync('lng', {
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
							await this.setObjectNotExistsAsync('date', {
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
		
							// Creating the Object 'priority' -> response JSON key 'data.priority'
							await this.setObjectNotExistsAsync('priority', {
								type: 'state',
								common: {
									name: 'Priorität/Sonderrechte',
									type: 'boolean',
									role: 'indicator',
									read: true,
									write: false
								},
								native: {},
							});

							// Creating the Object 'addressed_users' -> response JSON key 'data.ucr_addressed'
							await this.setObjectNotExistsAsync('addressed_users', {
								type: 'state',
								common: {
									name: 'Alarmierte Benutzer',
									type: 'string',
									role: 'text',
									read: true,
									write: false
								},
								native: {},
							});

							// Creating the Object 'addressed_group' -> response JSON key 'data.group'
							await this.setObjectNotExistsAsync('addressed_groups', {
								type: 'state',
								common: {
									name: 'Alarmierte Gruppen',
									type: 'string',
									role: 'text',
									read: true,
									write: false
								},
								native: {},
							});
		
							// Creating the Object 'lastUpdate' -> current timestamp
							await this.setObjectNotExistsAsync('lastUpdate', {
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
							await this.setState('title', { val: null});
							await this.setState('text', { val: null});
							await this.setState('foreign_id', { val: null});
							await this.setState('address', { val: null});
							await this.setState('lat', { val: null});
							await this.setState('lng', { val: null});
							await this.setState('date', { val: null});
							await this.setState('priority', { val: null});
							await this.setState('addressed_users', { val: null});
							await this.setState('addressed_groups', { val: null});
							await this.setState('lastUpdate', { val: null});
							await this.setState('alarm', { val: false});
						
	
						// Registration of an interval calling the main function for this adapter
						let repeatingFunctionCall = setInterval(() => {
							this.getDataFromApiAndSetObjects(diveraAccessKey, diveraUserId);
						}, pollIntervallMilliseconds);
					}
				} else {
					this.log.error('The update interval must be at least ' + pollIntervallSecondsMinimum + ' seconds!');
				}
			} else {
				this.log.error('User ID is not valid!');
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
				if (response.status == 200) {
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
	getDataFromApiAndSetObjects(diveraAccessKey, diveraUserId) {
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

				// Setting the update state
				this.setState('lastUpdate', { val: Date.now(), ack: true });
				
				// Setting the alarm specific states when a new alarm is active and addressed to the configured divera user id
				if (content.success && lastAlarmId != content.data.id) {
					lastAlarmId = content.data.id;
					lastAlarmStatus = content.success;
					if (content.data.ucr_addressed.includes(diveraUserId)) {
						this.setState('title', { val: content.data.title, ack: true });
						this.setState('text', { val: content.data.text, ack: true });
						this.setState('foreign_id', { val: content.data.foreign_id, ack: true });
						this.setState('address', { val: content.data.address, ack: true });
						this.setState('lat', { val: content.data.lat, ack: true });
						this.setState('lng', { val: content.data.lng, ack: true });
						this.setState('date', { val: content.data.date * 1000, ack: true });
						this.setState('priority', { val: content.data.priority, ack: true });
						this.setState('addressed_users', { val: content.data.ucr_addressed, ack: true });
						this.setState('addressed_groups', { val: content.data.group, ack: true });
						this.setState('alarm', { val: content.success, ack: true });
					}
				} else if (content.success != lastAlarmStatus) {
					lastAlarmStatus = content.success;
					this.setState('alarm', { val: content.success, ack: true });
				}
			}.bind(this)
		).catch(
			function (error) {
				if (error.response) {
					// The request was made and the server responded with a error status code
					if (error.response.status == 403) {
						this.log.error('Access-Token has been invalid. Please use a valid token!');
						this.setState('alarm', { val: content.success, ack: true });this.setState('info.connection', false, true);
					} else {
						this.log.warn('received error ' + error.response.status + ' response with content: ' + JSON.stringify(error.response.data));
						this.setState('alarm', { val: content.success, ack: true });this.setState('info.connection', false, true);
					}
				} else if (error.request) {
					// The request was made but no response was received
					this.log.error(error.message);
					this.setState('alarm', { val: content.success, ack: true });this.setState('info.connection', false, true);
				} else {
					// Something happened in setting up the request that triggered an Error
					this.log.error(error.message);
					this.setState('alarm', { val: content.success, ack: true });this.setState('info.connection', false, true);
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