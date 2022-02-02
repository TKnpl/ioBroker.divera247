'use strict';

const utils = require('@iobroker/adapter-core');
const axios = require('axios');
const { DH_UNABLE_TO_CHECK_GENERATOR } = require('constants');
const adapterName = require('./package.json').name.split('.').pop();

let diveraAPIAccessToken = "";
let diveraMemberships;
let lastAlarmId = null;
let alarmIsActive = false;

const pollIntervallSeconds = 15;

class Divera247 extends utils.Adapter {

	constructor(options) {
		super({
			...options,
			name: adapterName,
		});

		this.refreshStateTimeout = null;

		this.on('ready', this.onReady.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	async onReady() {
		this.setState('info.connection', false, true);

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

		// Creating the Object 'addressed_vehicle' -> response JSON key 'data.vehicle'
		await this.setObjectNotExistsAsync('addressed_vehicle', {
			type: 'state',
			common: {
				name: 'Alarmierte Fahrzeuge',
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
		// await this.setStateAsync('title', { val: null, ack: false });
		// await this.setStateAsync('text', { val: null, ack: false });
		// await this.setStateAsync('foreign_id', { val: null, ack: false });
		// await this.setStateAsync('address', { val: null, ack: false });
		// await this.setStateAsync('lat', { val: null, ack: false });
		// await this.setStateAsync('lng', { val: null, ack: false });
		// await this.setStateAsync('date', { val: null, ack: false });
		// await this.setStateAsync('priority', { val: null, ack: false });
		// await this.setStateAsync('addressed_users', { val: null, ack: false });
		// await this.setStateAsync('addressed_groups', { val: null, ack: false });
		// await this.setStateAsync('addressed_vehicle', { val: null, ack: false });
		// await this.setStateAsync('lastUpdate', { val: null, ack: false });
		// await this.setStateAsync('alarm', { val: false, ack: true });

		////////////////////////////////////////\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
		const diveraLoginName = this.config.diveraUserLogin;
		const diveraLoginPassword = this.config.diveraLoginPassword;
		const diveraFilterOnlyAlarmsForMyUser = this.config.explizitUserAlarms;
		const diveraUserIdInput = this.config.diveraUserId;
		const diveraUserGroupInput = this.config.diveraAlarmGroup;

		let diveraUserIDs = diveraUserIdInput.replace(/\s/g, "").split(',');
		let diveraUserGroups = diveraUserGroupInput.replace(/\s/g, "").split(',');

		// Check if all values of diveraUserIDs are numbers => valid
		let userIDInputIsValid = true;
		if (diveraUserIDs.length > 0 && diveraUserIDs[0] != "") {
			for (let userIDfromInput of diveraUserIDs) {
				if (isNaN(userIDfromInput)) {
					this.log.error('UserID \'' + userIDfromInput + '\' is not a Number')
					userIDInputIsValid = false;
					break;
				}
			}
		};

		// Check if all values of diveraUserGroups are numbers => valid
		let userGroupInputIsValid = true;
		if (diveraUserGroups.length > 0 && diveraUserGroups[0] != "") {
			for (let userGroupfromInput of diveraUserGroups) {
				if (isNaN(userGroupfromInput)) {
					this.log.error('UserGroup \'' + userGroupfromInput + '\' is not a Number')
					userGroupInputIsValid = false;
					break;
				}
			}
		};

		// Startup logic from here. Login and API calls
		if (diveraLoginName && diveraLoginPassword && pollIntervallSeconds && userIDInputIsValid && userGroupInputIsValid) {
			if (await this.checkConnectionToApi(diveraLoginName, diveraLoginPassword)) {
				// Connected to API
				this.setState('info.connection', true, true);

				// Start repeating Call of the API
				await this.getDataFromApiAndSetObjects(diveraAPIAccessToken, diveraFilterOnlyAlarmsForMyUser, diveraUserIDs, diveraUserGroups);
			} else {
				this.log.error('Login to API failed');
			}
		} else {
			this.log.warn('Adapter configuration is invalid');
		}
	}

	/*
	*	Function to login to the API
	*	returns true / false
	*	If successful, it is setting diveraAPIAccessToken and diveraMemberships
	*/
	checkConnectionToApi(diveraLoginName, diveraLoginPassword) {
		// Calling and loggin in into the API V2
		return axios({
			method: 'post',
			baseURL: 'https://www.divera247.com/',
			url: '/api/v2/auth/login',
			data: {
				Login: {
					username: diveraLoginName,
					password: diveraLoginPassword,
					jwt: false
				}
			},
			responseType: 'json'
		}).then(
			function (response) {
				const responseBody = response.data;

				if (response.status == 200 && responseBody.success) {
					this.log.debug('Connected to API');
					diveraAPIAccessToken = responseBody.data.user.access_token;
					diveraMemberships = responseBody.data.ucr;
					return true;
				} else {
					return false;
				}
			}.bind(this)
		).catch(
			function (error) {
				if (error.response) {
					// The request was made and the server responded with a error status code
					this.log.error('received error ' + error.response.status + ' response with content: ' + JSON.stringify(error.response.data));
					return false;
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
	async getDataFromApiAndSetObjects(diveraAccessKey, diveraFilterOnlyAlarmsForMyUser, diveraUserIDs, diveraUserGroups) {
		// Calling the alerting-server api
		await axios({
			method: 'get',
			baseURL: 'https://www.divera247.com/',
			url: '/api/v2/alarms?accesskey=' + diveraAccessKey,
			responseType: 'json'
		}).then(
			function (response) {
				const content = response.data;

				// If last request failed set info.connection true again 
				this.getState('info.connection', function (err, state) {
					if (!state.val) {
						this.setState('info.connection', true, true);
						this.log.debug('Reconnected to API successfully');
					}
				}.bind(this)
				);

				// Setting the update state
				this.setState('lastUpdate', { val: Date.now(), ack: true });

				// Setting the alarm specific states when a new alarm is active and addressed to the configured divera user id
				if (content.success && Object.keys(content.data.items).length > 0) {
					let lastAlarmContent = content.data.items[content.data.sorting[0]];
					if (lastAlarmId != lastAlarmContent.id && !lastAlarmContent.closed) {
						this.log.debug('Alarm!');
						this.log.debug('Received data from Divera-API: ' + JSON.stringify(content));
						this.getMembershipIds();

						lastAlarmId = lastAlarmContent.id;
						alarmIsActive = !lastAlarmContent.closed;

						// Variable for checking if alarm already given
						let adapterStatesRefreshedForThisAlarm = false;

						// Checking if only user alarms should be displayed
						if (diveraFilterOnlyAlarmsForMyUser) {
							let myDiveraUserIDs = this.getMembershipIds();
							for (let elm of myDiveraUserIDs) {
								this.log.debug('checking if my user-id \'' + elm + '\' is alarmed');
								if (lastAlarmContent.ucr_addressed.includes(parseInt(elm, 10))) {
									this.setAdapterStates(lastAlarmContent);
									this.log.debug('my user is alarmed - states refreshed for the current alarm');
									adapterStatesRefreshedForThisAlarm = true;
									break;
								} else {
									this.log.debug('user is not alarmed');
								}
							}
						}

						// Checking if userIDs are specified and alarmed
						if (diveraUserIDs.length > 0 && diveraUserIDs != "" && !adapterStatesRefreshedForThisAlarm) {
							for (let elm of diveraUserIDs) {
								this.log.debug('checking if user \'' + elm + '\' is alarmed');
								if (lastAlarmContent.ucr_addressed.includes(parseInt(elm, 10))) {
									this.setAdapterStates(lastAlarmContent);
									this.log.debug('user is alarmed - states refreshed for the current alarm');
									adapterStatesRefreshedForThisAlarm = true;
									break;
								} else {
									this.log.debug('user is not alarmed');
								}
							}
						}

						// Checking if groups are specified and alarmed
						if (diveraUserGroups.length > 0 && diveraUserGroups != "" && !adapterStatesRefreshedForThisAlarm) {
							for (let elm of diveraUserGroups) {
								this.log.debug('checking if group \'' + elm + '\' is alarmed');
								if (lastAlarmContent.group.includes(parseInt(elm, 10))) {
									this.setAdapterStates(lastAlarmContent);
									this.log.debug('group is alarmed - states refreshed for the current alarm');
									adapterStatesRefreshedForThisAlarm = true;
									break;
								} else {
									this.log.debug('group is not alarmed');
								}
							}
						}

						// Updating states if no userID or group is specified
						if (!adapterStatesRefreshedForThisAlarm) {
							this.log.debug('userID and group check skipped as of no userID or group is specified or my user was already alarmed');
							this.setAdapterStates(lastAlarmContent);
							this.log.debug('states refreshed for the current alarm');
						}
					} else if (lastAlarmId == lastAlarmContent.id && lastAlarmContent.closed && alarmIsActive) {
						this.setState('alarm', { val: !lastAlarmContent.closed, ack: true });
						this.log.debug('alarm is closed');
						alarmIsActive = !lastAlarmContent.closed;
					}
				}
			}.bind(this)
		).catch(
			function (error) {
				if (error.response) {
					// The request was made and the server responded with a error status code
					if (error.response.status == 403) {
						this.log.error('Login not possible');
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

		// Timeout and self call handling
		this.refreshStateTimeout = this.refreshStateTimeout || setTimeout(() => {
			this.refreshStateTimeout = null;
			this.getDataFromApiAndSetObjects(diveraAccessKey, diveraUserIDs, diveraUserGroups);
		}, pollIntervallSeconds * 1000);
	}

	// Function to set satates
	setAdapterStates(alarmData) {
		this.setState('title', { val: alarmData.title, ack: true });
		this.setState('text', { val: alarmData.text, ack: true });
		this.setState('foreign_id', { val: parseInt(alarmData.foreign_id), ack: true });
		this.setState('address', { val: alarmData.address, ack: true });
		this.setState('lat', { val: alarmData.lat, ack: true });
		this.setState('lng', { val: alarmData.lng, ack: true });
		this.setState('date', { val: alarmData.date, ack: true });
		this.setState('priority', { val: alarmData.priority, ack: true });
		this.setState('addressed_users', { val: alarmData.ucr_addressed.join(), ack: true });
		this.setState('addressed_groups', { val: alarmData.group.join(), ack: true });
		this.setState('addressed_vehicle', { val: alarmData.vehicle.join(), ack: true });
		this.setState('alarm', { val: true, ack: true });
	}

	getMembershipIds() {
		let memberShipIDs = [];
		diveraMemberships.forEach(element => {
			memberShipIDs.push(element.id);
		});
		return memberShipIDs
	}

	// Is called when adapter shuts down
	onUnload(callback) {
		try {
			if (this.refreshStateTimeout) {
				this.log.debug('clearing refreshStateTimeout');
				clearTimeout(this.refreshStateTimeout);
			}
			this.log.debug('cleaned everything up');
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