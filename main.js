'use strict';

const utils = require('@iobroker/adapter-core');
const axios = require('axios');
const adapterName = require('./package.json').name.split('.').pop();

const userData = {
	diveraAPIToken: '',
	/** @type {any[]} */
	diveraMemberships: [],
};

const internalAlarmData = {
	alarmID: 0,
	alarmClosed: true,
	lastAlarmUpdate: 0,
};


const pollIntervalMinimumSeconds = 10;

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
		this.pollIntervalSeconds = 30;

		this.on('ready', this.onReady.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	async onReady() {
		this.setState('info.connection', false, true);

		// Generating DataPoints for this adapter
		for (const elm of dataPoints) {
			await this.setObjectNotExistsAsync(elm.id, {
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
		}

		// Initialise the states at startup so they are never null (booleans default to false), like in 0.1.2
		await this.resetAlarmStates();

		////////////////////////////////////////\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
		const diveraLoginName = this.config.diveraUserLogin;
		const diveraLoginPassword = this.config.diveraLoginPassword;
		const diveraFilterOnlyAlarmsForMyUser = this.config.explizitUserAlarms;
		const diveraUserIdInput = this.config.diveraUserId;
		const diveraUserGroupInput = this.config.diveraAlarmGroup;

		const diveraUserIDs = diveraUserIdInput.replace(/\s/g, '').split(',');
		const diveraUserGroups = diveraUserGroupInput.replace(/\s/g, '').split(',');

		// Check if all values of diveraUserIDs are valid
		const userIDInputIsValid = this.uiFilterIsValid(diveraUserIDs)[0];

		// Check if all values of diveraUserGroups are valid
		const userGroupInputIsValid = this.uiFilterIsValid(diveraUserGroups)[0];

		// Poll interval in seconds (configurable like in 0.1.2), clamped to a sane minimum
		let pollIntervalSeconds = parseInt(String(this.config.pollInterval), 10);
		if (isNaN(pollIntervalSeconds) || pollIntervalSeconds < pollIntervalMinimumSeconds) {
			pollIntervalSeconds = pollIntervalMinimumSeconds;
		}
		this.pollIntervalSeconds = pollIntervalSeconds;

		// Startup logic from here. Login and API calls
		if (diveraLoginName && diveraLoginPassword && this.pollIntervalSeconds && userIDInputIsValid && userGroupInputIsValid) {
			if (await this.checkConnectionToApi(diveraLoginName, diveraLoginPassword)) {
				// Connected to API
				this.setState('info.connection', true, true);

				this.log.debug('Login passed');

				// Start repeating Call of the API
				this.getDataFromApiAndSetObjects(userData.diveraAPIToken, diveraFilterOnlyAlarmsForMyUser, diveraUserIDs, diveraUserGroups);
			} else {
				this.log.error('Login to API failed');
			}
		} else {
			this.log.warn('Adapter configuration is invalid');
		}
	}

	uiFilterIsValid(obj) {
		const valuesGiven = obj.length > 0;
		let valuesGivenAndValid = false;
		if (valuesGiven) {
			let allInputsValid = true;
			obj.forEach( (elm) => {
				isNaN(Number(elm)) ? allInputsValid = false : '';
			});
			valuesGivenAndValid = allInputsValid;
		}
		return [valuesGiven ? valuesGivenAndValid : true, valuesGiven];
	}

	/**
	 *	Function to login to the API
	 *	returns true / false
	 *	If successful, it is setting userData.diveraAPIToken and userData.diveraMemberships
	 *
	 * @param {string} diveraLoginName
	 * @param {string} diveraLoginPassword
	 */
	checkConnectionToApi(diveraLoginName, diveraLoginPassword) {
		// Calling and loggin in into the API V2
		// @ts-ignore
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
			(response) => {
				const responseBody = response.data;

				if (response.status == 200 && responseBody.success) {
					this.log.debug('Connected to API');
					userData.diveraAPIToken = responseBody.data.user.access_token;
					// 'ucr' may be returned as an array or as an object keyed by id - normalize to an array
					const ucr = responseBody.data.ucr;
					userData.diveraMemberships = Array.isArray(ucr) ? ucr : Object.values(ucr || {});
					this.log.debug('Divera Memberships: ' + JSON.stringify(userData.diveraMemberships));
					return true;
				} else {
					return false;
				}
			}
		).catch(
			(error) => {
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
			}
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
		// Calling the pull/all endpoint - it works for all Divera versions (incl. FREE) and
		// returns alarms (data.alarm), the unit data and the monitor in a single request.
		// The dedicated /api/v2/alarms (CRUD) endpoint is forbidden (403) for FREE accounts.
		// @ts-ignore
		await axios({
			method: 'get',
			baseURL: 'https://www.divera247.com/',
			url: '/api/v2/pull/all?accesskey=' + diveraAccessKey,
			responseType: 'json'
		}).then(
			async (response) => {
				const content = response.data;

				// If last request failed set info.connection true again
				// @ts-ignore
				this.getState('info.connection',  (err, state) => {
					// @ts-ignore
					if (state && !state.val) {
						this.setState('info.connection', true, true);
						this.log.debug('Reconnected to API');
					}
				});

				// Setting the update state
				this.setState('lastUpdate', { val: Date.now(), ack: true });

				// Setting the alarm specific states when a new alarm is active and addressed to the configured divera user id
				const alarmRoot = (content.data && content.data.alarm) ? content.data.alarm : null;
				if (content.success && alarmRoot && alarmRoot.items && Array.isArray(alarmRoot.sorting) && alarmRoot.sorting.length > 0) {
					// 'sorting' is ascending (oldest first), so the most recent alarm is the last entry
					const latestAlarmId = alarmRoot.sorting[alarmRoot.sorting.length - 1];
					const alarmContent = alarmRoot.items[latestAlarmId];
					if (!alarmContent) {
						this.log.debug('No alarm content found for latest alarm id ' + latestAlarmId);
						return;
					}
					// The Divera v2 API spells the field 'ucr_adressed' (single 'd'); older v1 endpoints used 'ucr_addressed'
					const alarmAddressedUsers = alarmContent.ucr_addressed || alarmContent.ucr_adressed || [];
					if ((internalAlarmData.alarmID != alarmContent.id && !alarmContent.closed) || (internalAlarmData.alarmID == alarmContent.id && internalAlarmData.lastAlarmUpdate < alarmContent.ts_update && !alarmContent.closed)) {
						this.log.debug('New or updated alarm!');
						this.log.debug('Received data from Divera-API: ' + JSON.stringify(content));

						// Setting internal variables for later checkes
						internalAlarmData.alarmID = alarmContent.id;
						internalAlarmData.alarmClosed = alarmContent.closed;
						internalAlarmData.lastAlarmUpdate = alarmContent.ts_update;

						// Checking UI Input filter and trigger update the states
						if (diveraFilterOnlyAlarmsForMyUser) {
							for (const elm of userData.diveraMemberships) {
								this.log.debug('checking if my user-id \'' + elm.id + '\' for \'' + elm.name + '\' is alarmed');
								if (alarmAddressedUsers.includes(parseInt(elm.id, 10))) {
									this.setAdapterStates(alarmContent);
									this.log.debug('my user is alarmed - states refreshed for the current alarm');
									break;
								} else {
									this.log.debug('user is not alarmed');
								}
							}
						} else if (diveraUserIDs.length > 0 && diveraUserIDs[0] != '') {
							for (const elm of diveraUserIDs) {
								this.log.debug('checking if user \'' + elm + '\' is alarmed');
								if (alarmAddressedUsers.includes(parseInt(elm, 10))) {
									this.setAdapterStates(alarmContent);
									this.log.debug('user is alarmed - states refreshed for the current alarm');
									break;
								} else {
									this.log.debug('user is not alarmed');
								}
							}
						} else if (diveraUserGroups.length > 0 && diveraUserGroups[0] != '') {
							for (const elm of diveraUserGroups) {
								this.log.debug('checking if group \'' + elm + '\' is alarmed');
								if (Array.isArray(alarmContent.group) && alarmContent.group.includes(parseInt(elm, 10))) {
									this.setAdapterStates(alarmContent);
									this.log.debug('group is alarmed - states refreshed for the current alarm');
									break;
								} else {
									this.log.debug('group is not alarmed');
								}
							}
						} else {
							this.log.debug('userID and group check skipped as of no userID or group is specified or my user was already alarmed');
							this.setAdapterStates(alarmContent);
							this.log.debug('states refreshed for the current alarm');
						}
					} else if (internalAlarmData.alarmID == alarmContent.id && alarmContent.closed && !internalAlarmData.alarmClosed) {
						await this.resetAlarmStates();
						this.log.debug('alarm is closed - alarm states reset');
						internalAlarmData.alarmClosed = alarmContent.closed;
					}
				} else if (content.success) {
					// API call succeeded but there is no active (non-archived) alarm -> clear a previously set alarm (see upstream PR #22)
					if (internalAlarmData.alarmID !== 0) {
						await this.resetAlarmStates();
						this.log.debug('alarm list is empty - alarm states reset');
						internalAlarmData.alarmID = 0;
						internalAlarmData.alarmClosed = true;
					}
				} else {
					this.log.warn('api content retrieval not successful');
				}
			}
		).catch(
			(error) => {
				if (error.response) {
					// The request was made and the server responded with a error status code
					if (error.response.status == 403) {
						this.log.error('API request forbidden (403) - the accesskey is missing the required permission for this endpoint');
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
			}
		);


		// Timeout and self call handling
		this.refreshStateTimeout = this.refreshStateTimeout || setTimeout(() => {
			this.refreshStateTimeout = null;
			this.getDataFromApiAndSetObjects(diveraAccessKey, diveraFilterOnlyAlarmsForMyUser, diveraUserIDs, diveraUserGroups);
		}, this.pollIntervalSeconds * 1000);
	}

	// Function to set satates
	/**
	 * @param {{ title: string; text: string; foreign_id: number; id: number; address: string; lat: number; lng: number; date: number; priority: boolean; ucr_addressed?: number[]; ucr_adressed?: number[]; group: number[]; vehicle: string[]; }} alarmData
	 */
	setAdapterStates(alarmData) {
		// The Divera v2 API spells the field 'ucr_adressed' (single 'd'); older v1 endpoints used 'ucr_addressed'
		const addressedUsers = alarmData.ucr_addressed || alarmData.ucr_adressed || [];
		const addressedGroups = Array.isArray(alarmData.group) ? alarmData.group : [];
		const addressedVehicles = Array.isArray(alarmData.vehicle) ? alarmData.vehicle : [];

		this.setState('title', { val: alarmData.title, ack: true });
		this.setState('text', { val: alarmData.text, ack: true });
		this.setState('foreign_id', { val: Number(alarmData.foreign_id), ack: true });
		this.setState('divera_id', { val: Number(alarmData.id), ack: true });
		this.setState('address', { val: alarmData.address, ack: true });
		this.setState('lat', { val: Number(alarmData.lat), ack: true });
		this.setState('lng', { val: Number(alarmData.lng), ack: true });
		this.setState('date', { val: Number(alarmData.date)*1000, ack: true });
		this.setState('priority', { val: alarmData.priority, ack: true });
		this.setState('addressed_users', { val: addressedUsers.join(), ack: true });
		this.setState('addressed_groups', { val: addressedGroups.join(), ack: true });
		this.setState('addressed_vehicle', { val: addressedVehicles.join(), ack: true });
		this.setState('alarm', { val: true, ack: true });
	}

	/**
	 *	Reset all alarm related states to their defaults (booleans to false, the rest to null).
	 *	Called at startup and whenever there is no active alarm anymore. lastUpdate is kept.
	 */
	async resetAlarmStates() {
		for (const elm of dataPoints) {
			if (elm.id === 'lastUpdate') {
				continue;
			}
			await this.setState(elm.id, { val: (elm.type === 'boolean') ? false : null, ack: true });
		}
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