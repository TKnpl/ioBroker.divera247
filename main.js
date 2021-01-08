'use strict';

const utils = require('@iobroker/adapter-core');
const axios = require('axios');
const adapterName = require('./package.json').name.split('.').pop();

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
		const diveraAccessKey				= this.config.diveraAccessKey;
		const pollIntervallSeconds			= this.config.pollIntervall;
		const pollIntervallMilliseconds		= pollIntervallSeconds * 1000;
		const pollIntervallSecondsMinimum	= 10;

		if (pollIntervallSeconds >= pollIntervallSecondsMinimum) {
			// Initial call of the main function for this adapter
			this.getDataFromApiAndSetObjects(diveraAccessKey);
			
			// Registration of an interval calling the main function for this adapter
			let repeatingFunctionCall = setInterval(() => {
				this.getDataFromApiAndSetObjects(diveraAccessKey);
			}, pollIntervallMilliseconds);
		} else {
			this.log.error('The update interval must be at least ' + pollIntervallSecondsMinimum + ' seconds!');
			this.setState('info.connection', false, true);
		}
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
	
	/**
	* Main function for this adapter
	* It calls the api of the alerting-server and sets the relevant states
	*/
	getDataFromApiAndSetObjects(diveraAccessKey) {		
		// Calling the alerting-server api
		axios({
			method: 'get',
			baseURL: 'https://www.divera247.com/',
			url: '/api/last-alarm?accesskey=' + diveraAccessKey,
			responseType: 'json'
		}).then(
			function(response) {
				const content = response.data;
				
				this.log.debug('Received data from Divera-API (' + response.status + '): ' + JSON.stringify(content));
				
				// Set adapter connected true
				this.setState('info.connection', true, true);

				// Setting or refreshing the Object 'alarm' -> response JSON key 'success'
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
				this.setState('alarm', {val: content.success, ack: true});
				
				// Setting or refreshing the Object 'lastUpdate' -> current timestamp
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
				this.setState('lastUpdate', {val: Date.now(), ack: true});
			}.bind(this)
		).catch(
			function (error) {
            	if (error.response) {
                    // The request was made and the server responded with a error status code
                    this.log.warn('received error ' + error.response.status + ' response with content: ' + JSON.stringify(error.response.data));
					this.setState('info.connection', false, true);
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