'use strict';

const utils = require('@iobroker/adapter-core');
const axios = require('axios');
const adapterName = require('./package.json').name.split('.').pop();

let diveraAPIAccessToken = '';
let diveraMemberships;
let lastAlarmId = null;
let alarmIsActive = false;

const pollIntervallSeconds = 15;

const dataPoints = [{
	'id': 'alarm',
	'name': 'Alarm',
	'type': 'boolean',
	'role': 'indicator',
	'read': true,
	'write': false
},
{
	'id': 'title',
	'name': 'Einsatzstichwort',
	'type': 'string',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'text',
	'name': 'Meldungstext',
	'type': 'string',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'foreign_id',
	'name': 'Einsatznummer',
	'type': 'number',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'divera_id',
	'name': 'Einsatz ID',
	'type': 'number',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'address',
	'name': 'Adresse',
	'type': 'string',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'lat',
	'name': 'Längengrad',
	'type': 'number',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'lng',
	'name': 'Breitengrad',
	'type': 'number',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'date',
	'name': 'Alarmierungszeit',
	'type': 'number',
	'role': 'date',
	'read': true,
	'write': false
},
{
	'id': 'priority',
	'name': 'Priorität/Sonderrechte',
	'type': 'boolean',
	'role': 'indicator',
	'read': true,
	'write': false
},
{
	'id': 'addressed_users',
	'name': 'Alarmierte Benutzer',
	'type': 'string',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'addressed_groups',
	'name': 'Alarmierte Gruppen',
	'type': 'string',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'addressed_vehicle',
	'name': 'Alarmierte Fahrzeuge',
	'type': 'string',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'lastUpdate',
	'name': 'Letzte Aktualisierung',
	'type': 'number',
	'role': 'date',
	'read': true,
	'write': false
}];

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

		// Generating DataPoints for this adapter
		dataPoints.forEach(function (elm) {
			this.setObjectNotExistsAsync(elm.id, {
				type: 'state',
				common: {
					name: elm.name,
					type: elm.type,
					role: elm.role,
					read: elm.read,
					write: elm.write
				},
				native: {},
			});
		}.bind(this));

		////////////////////////////////////////\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
		const diveraLoginName = this.config.diveraUserLogin;
		const diveraLoginPassword = this.config.diveraLoginPassword;
		const diveraFilterOnlyAlarmsForMyUser = this.config.explizitUserAlarms;
		const diveraUserIdInput = this.config.diveraUserId;
		const diveraUserGroupInput = this.config.diveraAlarmGroup;

		const diveraUserIDs = diveraUserIdInput.replace(/\s/g, '').split(',');
		const diveraUserGroups = diveraUserGroupInput.replace(/\s/g, '').split(',');

		// Check if all values of diveraUserIDs are numbers => valid
		let userIDInputIsValid = true;
		if (diveraUserIDs.length > 0 && diveraUserIDs[0] != '') {
			for (const userIDfromInput of diveraUserIDs) {
				if (isNaN(Number(userIDfromInput))) {
					this.log.error('UserID \'' + userIDfromInput + '\' is not a Number');
					userIDInputIsValid = false;
					break;
				}
			}
		}

		// Check if all values of diveraUserGroups are numbers => valid
		let userGroupInputIsValid = true;
		if (diveraUserGroups.length > 0 && diveraUserGroups[0] != '') {
			for (const userGroupfromInput of diveraUserGroups) {
				if (isNaN(Number(userGroupfromInput))) {
					this.log.error('UserGroup \'' + userGroupfromInput + '\' is not a Number');
					userGroupInputIsValid = false;
					break;
				}
			}
		}

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

	/**
	 *	Function to login to the API
	 *	returns true / false
	 *	If successful, it is setting diveraAPIAccessToken and diveraMemberships
	 *
	 * @param {string} diveraLoginName
	 * @param {string} diveraLoginPassword
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
		);
	}

	/**
	 *	Function that calls the API and set the Object States
	 *
	 * @param {string} diveraAccessKey
	 * @param {boolean} diveraFilterOnlyAlarmsForMyUser
	 * @param {string[]} diveraUserIDs
	 * @param {string[]} diveraUserGroups
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
					const lastAlarmContent = content.data.items[content.data.sorting[0]];
					if (lastAlarmId != lastAlarmContent.id && !lastAlarmContent.closed) {
						this.log.debug('Alarm!');
						this.log.debug('Received data from Divera-API: ' + JSON.stringify(content));

						lastAlarmId = lastAlarmContent.id;
						alarmIsActive = !lastAlarmContent.closed;

						// Variable for checking if alarm already given
						let adapterStatesRefreshedForThisAlarm = false;

						// Checking if only user alarms should be displayed
						if (diveraFilterOnlyAlarmsForMyUser) {
							const myDiveraUserIDs = this.getMembershipIds();
							for (const elm of myDiveraUserIDs) {
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
						if (this.diveraUserIDs.length > 0 && this.diveraUserIDs[0] != '' && !adapterStatesRefreshedForThisAlarm) {
							for (const elm of this.diveraUserIDs) {
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
						if (this.diveraUserGroups.length > 0 && this.diveraUserGroups[0] != '' && !adapterStatesRefreshedForThisAlarm) {
							for (const elm of this.diveraUserGroups) {
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
		);

		// Timeout and self call handling
		this.refreshStateTimeout = this.refreshStateTimeout || setTimeout(() => {
			this.refreshStateTimeout = null;
			this.getDataFromApiAndSetObjects(diveraAccessKey, diveraFilterOnlyAlarmsForMyUser, diveraUserIDs, diveraUserGroups);
		}, pollIntervallSeconds * 1000);
	}

	// Function to set satates
	/**
	 * @param {{ title: string; text: string; foreign_id: number; id: number; address: string; lat: number; lng: number; date: number; priority: boolean; ucr_addressed: string[]; group: string[]; vehicle: string[]; }} alarmData
	 */
	setAdapterStates(alarmData) {
		this.setState('title', { val: alarmData.title, ack: true });
		this.setState('text', { val: alarmData.text, ack: true });
		this.setState('foreign_id', { val: Number(alarmData.foreign_id), ack: true });
		this.setState('divera_id', { val: Number(alarmData.id), ack: true });
		this.setState('address', { val: alarmData.address, ack: true });
		this.setState('lat', { val: Number(alarmData.lat), ack: true });
		this.setState('lng', { val: Number(alarmData.lng), ack: true });
		this.setState('date', { val: Number(alarmData.date), ack: true });
		this.setState('priority', { val: alarmData.priority, ack: true });
		this.setState('addressed_users', { val: alarmData.ucr_addressed.join(), ack: true });
		this.setState('addressed_groups', { val: alarmData.group.join(), ack: true });
		this.setState('addressed_vehicle', { val: alarmData.vehicle.join(), ack: true });
		this.setState('alarm', { val: true, ack: true });
	}

	getMembershipIds() {
		const memberShipIDs = [];
		diveraMemberships.forEach(element => {
			memberShipIDs.push(element.id);
		});
		this.log.debug('memberShipIDs: ' + JSON.stringify(memberShipIDs));
		return memberShipIDs;
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