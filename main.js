'use strict';

const utils = require('@iobroker/adapter-core');
const axios = require('axios');
const adapterName = require('./package.json').name.split('.').pop();

const userData = [];
userData['diveraAPIToken'] = '';
userData['diveraMemberships'] = [];

const internalAlarmData = [];
internalAlarmData['alarmID'] = 0;
internalAlarmData['alarmClosed'] = true;
internalAlarmData['lastAlarmUpdate'] = 0;


const pollIntervallSeconds = 15;

const dataPoints = [{
	'id': 'alarm.alarm',
	'name': 'Alarm',
	'type': 'boolean',
	'role': 'indicator',
	'read': true,
	'write': false
},
{
	'id': 'alarm.title',
	'name': 'Einsatzstichwort',
	'type': 'string',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'alarm.text',
	'name': 'Meldungstext',
	'type': 'string',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'alarm.foreign_id',
	'name': 'Einsatznummer',
	'type': 'number',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'alarm.divera_id',
	'name': 'Einsatz ID',
	'type': 'number',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'alarm.address',
	'name': 'Adresse',
	'type': 'string',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'alarm.lat',
	'name': 'Längengrad',
	'type': 'number',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'alarm.lng',
	'name': 'Breitengrad',
	'type': 'number',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'alarm.date',
	'name': 'Alarmierungszeit',
	'type': 'number',
	'role': 'date',
	'read': true,
	'write': false
},
{
	'id': 'alarm.priority',
	'name': 'Priorität/Sonderrechte',
	'type': 'boolean',
	'role': 'indicator',
	'read': true,
	'write': false
},
{
	'id': 'alarm.addressed_users',
	'name': 'Alarmierte Benutzer',
	'type': 'string',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'alarm.addressed_groups',
	'name': 'Alarmierte Gruppen',
	'type': 'string',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'alarm.addressed_vehicle',
	'name': 'Alarmierte Fahrzeuge',
	'type': 'string',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'info.lastUpdate',
	'name': 'Letzte Aktualisierung',
	'type': 'number',
	'role': 'date',
	'read': true,
	'write': false
},
{
	'id': 'status.id',
	'name': 'Status ID',
	'type': 'number',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'status.name',
	'name': 'Status Name',
	'type': 'string',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'status.note',
	'name': 'Status Notiz',
	'type': 'string',
	'role': 'text',
	'read': true,
	'write': false
},
{
	'id': 'status.set.number',
	'name': 'Status setzen',
	'type': 'number',
	'role': 'value',
	'read': false,
	'write': true
},
{
    'id': 'status.set.id',
    'name': 'Status ID',
    'type': 'number',
    'role': 'value',
    'read': true,
    'write': true
},
{
    'id': 'status.set.vehicle',
    'name': 'Vehicle ID',
    'type': 'number',
    'role': 'value',
    'read': true,
    'write': true
},
{
    'id': 'status.set.note',
    'name': 'Note',
    'type': 'string',
    'role': 'text',
    'read': true,
    'write': true
},
{
    'id': 'status.set.reset_date',
    'name': 'Reset Date',
    'type': 'number',
    'role': 'value',
    'read': true,
    'write': true
},
{
    'id': 'status.set.reset_to',
    'name': 'Reset To',
    'type': 'number',
    'role': 'value',
    'read': true,
    'write': true
},
{
    'id': 'status.set.alarm_skip',
    'name': 'Alarm Skip',
    'type': 'boolean',
    'role': 'switch',
    'read': true,
    'write': true
},
{
    'id': 'status.set.status_skip_statusplan',
    'name': 'Status Skip Statusplan',
    'type': 'boolean',
    'role': 'switch',
    'read': true,
    'write': true
},
{
    'id': 'status.set.status_skip_geofence',
    'name': 'Status Skip Geofence',
    'type': 'boolean',
    'role': 'switch',
    'read': true,
    'write': true
},
{
    'id': 'status.set.set_status',
    'name': 'Set Status Button',
    'type': 'boolean',
    'role': 'button',
    'read': false,
    'write': true
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
		this.on('stateChange', this.onStateChange.bind(this));
	}

	async onReady() {
		this.setState('info.connection', false, true);

		await this.subscribeStatesAsync('*');

		// Generating DataPoints for this adapter
		dataPoints.forEach( (elm) => {
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
		});

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

		// Startup logic from here. Login and API calls
		if (diveraLoginName && diveraLoginPassword && pollIntervallSeconds && userIDInputIsValid && userGroupInputIsValid) {
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
					userData.diveraMemberships = responseBody.data.ucr;
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

		// Caling the Pull API
		// @ts-ignore
		await axios({
			method: 'get',
			baseURL: 'https://www.divera247.com/',
			url: '/api/v2/pull/all?accesskey=' + diveraAccessKey,
			responseType: 'json'
		}).then(
			(response) => {
				const content = response.data.data;

				// If last request failed set info.connection true again
				// @ts-ignore
				this.getState('info.connection',  (err, state) => {
					// @ts-ignore
					if (!state.val) {
						this.setState('info.connection', true, true);
						this.log.debug('Reconnected to API');
					}
				});

				//this.log.debug(JSON.stringify(response.data.data.status.status_id, getCircularReplacer()));

				if (response.data.success && Object.keys(content).length > 0) {

					if (content.status && content.cluster && content.cluster.status) {
						const statusId = content.status.status_id || 0;
						const statusInfo = content.cluster.status[statusId];
						const statusName = statusInfo ? statusInfo.name : 'Unbekannt';

						this.setState('status.id', statusId, true);
						this.setState('status.note', content.status.note || '', true);
						this.setState('status.name', statusName, true);
					}
				}
			}
		).catch(
			(error) => {
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
			}
		);

		// Calling the alerting-server api
		// @ts-ignore
		await axios({
			method: 'get',
			baseURL: 'https://www.divera247.com/',
			url: '/api/v2/alarms?accesskey=' + diveraAccessKey,
			responseType: 'json'
		}).then(
			(response) => {
				const content = response.data;

				// If last request failed set info.connection true again
				// @ts-ignore
				this.getState('info.connection',  (err, state) => {
					// @ts-ignore
					if (!state.val) {
						this.setState('info.connection', true, true);
						this.log.debug('Reconnected to API');
					}
				});

				// Setting the update state
				this.setState('info.lastUpdate', { val: Date.now(), ack: true });

				// Setting the alarm specific states when a new alarm is active and addressed to the configured divera user id
				if (content.success && Object.keys(content.data.items).length > 0) {
					const alarmContent = content.data.items[content.data.sorting[0]];
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
								if (alarmContent.ucr_addressed.includes(parseInt(elm.id, 10))) {
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
								if (alarmContent.ucr_addressed.includes(parseInt(elm, 10))) {
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
								if (alarmContent.group.includes(parseInt(elm, 10))) {
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
						this.setState('alarm', { val: !alarmContent.closed, ack: true });
						this.log.debug('alarm is closed');
						internalAlarmData.alarmClosed = alarmContent.closed;
					}
				}
			}
		).catch(
			(error) => {
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
			}
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
		this.setState('alarm.title', { val: alarmData.title, ack: true });
		this.setState('alarm.text', { val: alarmData.text, ack: true });
		this.setState('alarm.foreign_id', { val: Number(alarmData.foreign_id), ack: true });
		this.setState('alarm.divera_id', { val: Number(alarmData.id), ack: true });
		this.setState('alarm.address', { val: alarmData.address, ack: true });
		this.setState('alarm.lat', { val: Number(alarmData.lat), ack: true });
		this.setState('alarm.lng', { val: Number(alarmData.lng), ack: true });
		this.setState('alarm.date', { val: Number(alarmData.date)*1000, ack: true });
		this.setState('alarm.priority', { val: alarmData.priority, ack: true });
		this.setState('alarm.addressed_users', { val: alarmData.ucr_addressed.join(), ack: true });
		this.setState('alarm.addressed_groups', { val: alarmData.group.join(), ack: true });
		this.setState('alarm.addressed_vehicle', { val: alarmData.vehicle.join(), ack: true });
		this.setState('alarm.alarm', { val: true, ack: true });
	}

	async onStateChange(id, state) {
		if (state && !state.ack) {
			if (id === this.namespace + '.status.set.number') {
				const statusNumber = state.val;
				const url = `https://www.divera247.com/statusgeber.html?status=${statusNumber}&accesskey=${userData.diveraAPIToken}`;

				try {
					const response = await axios.get(url);
					this.log.info(`Status set to ${statusNumber}: ${response.status}`);
				} catch (error) {
					this.log.error(`Failed to set status to ${statusNumber}: ${error.message}`);
				}
				this.setState('status.set.number', { val: null, ack: true });
			}

			if (id === this.namespace + '.status.set.set_status') {
				const statusId = await this.getStateAsync(this.namespace + '.status.set.id');
				const vehicle = await this.getStateAsync(this.namespace + '.status.set.vehicle');
				const note = await this.getStateAsync(this.namespace + '.status.set.note');
				const resetDate = await this.getStateAsync(this.namespace + '.status.set.reset_date');
				const resetTo = await this.getStateAsync(this.namespace + '.status.set.reset_to');
				const alarmSkip = await this.getStateAsync(this.namespace + '.status.set.alarm_skip');
				const statusSkipStatusplan = await this.getStateAsync(this.namespace + '.status.set.status_skip_statusplan');
				const statusSkipGeofence = await this.getStateAsync(this.namespace + '.status.set.status_skip_geofence');

				const url = `https://www.divera247.com/api/v2/statusgeber/set-status?accesskey=${userData.diveraAPIToken}`;
				const data = {
					Status: {
						id: statusId ? statusId.val : null,
						vehicle: vehicle ? vehicle.val : null,
						note: note ? note.val : '',
						reset_date: resetDate ? resetDate.val : null,
						reset_to: resetTo ? resetTo.val : null,
						alarm_skip: alarmSkip ? alarmSkip.val : false,
						status_skip_statusplan: statusSkipStatusplan ? statusSkipStatusplan.val : false,
						status_skip_geofence: statusSkipGeofence ? statusSkipGeofence.val : false
					}
				};

				try {
					const response = await axios.post(url, data);
					this.log.info(`Status set via POST: ${response.status}`);
					// Reset states to null upon successful completion
					this.setState(this.namespace + '.status.set.id', { val: null, ack: true });
					this.setState(this.namespace + '.status.set.vehicle', { val: null, ack: true });
					this.setState(this.namespace + '.status.set.note', { val: '', ack: true });
					this.setState(this.namespace + '.status.set.reset_date', { val: null, ack: true });
					this.setState(this.namespace + '.status.set.reset_to', { val: null, ack: true });
					this.setState(this.namespace + '.status.set.alarm_skip', { val: false, ack: true });
					this.setState(this.namespace + '.status.set.status_skip_statusplan', { val: false, ack: true });
					this.setState(this.namespace + '.status.set.status_skip_geofence', { val: false, ack: true });
					this.setState(this.namespace + '.status.set.set_status', { val: false, ack: true });
				} catch (error) {
					this.log.error(`Failed to set status via POST: ${error.message}`);
				}
			}
		}
	}

	async onObjectChange(id, obj) {
		this.log.debug(`object ${id} changed: ${JSON.stringify(obj)}`);
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