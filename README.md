![Logo](admin/divera247_long.png)
# ioBroker.divera247

[![NPM version](http://img.shields.io/npm/v/iobroker.divera247.svg)](https://www.npmjs.com/package/iobroker.divera247)
[![Downloads](https://img.shields.io/npm/dm/iobroker.divera247.svg)](https://www.npmjs.com/package/iobroker.divera247)
![Number of Installations (latest)](http://iobroker.live/badges/divera247-installed.svg)
![Number of Installations (stable)](http://iobroker.live/badges/divera247-stable.svg)
[![Dependency Status](https://img.shields.io/david/TKnpl/iobroker.divera247.svg)](https://david-dm.org/TKnpl/iobroker.divera247)
[![Known Vulnerabilities](https://snyk.io/test/github/TKnpl/ioBroker.divera247/badge.svg)](https://snyk.io/test/github/TKnpl/ioBroker.divera247)

[![NPM](https://nodei.co/npm/iobroker.divera247.png?downloads=true)](https://nodei.co/npm/iobroker.divera247/)

**Tests:** ![Test and Release](https://github.com/TKnpl/ioBroker.divera247/workflows/Test%20and%20Release/badge.svg)

## divera247 adapter for ioBroker

Adapter for the alerting service "Divera 24/7"

## Requirements
Your organisation has to subscribe the "Alarm" license of Divera 24/7 services in minimum

## Configuartion of this adapter
You have to enter your personal "Divera 24/7" access token to this adapter.
To find out the token, go to the official [Divera 24 / 7 webseite](https://www.divera247.com/) and navigate to administration -> settings -> interfaces -> API. Here you can find the token in the "authorisation" area.
Copy the token and paste it in the admin page of this adapter.
Furthermore please chose an updating interval for calling the API server. 30 seconds are recommended. The minimum is 10 seconds.

## Changelog

### 0.0.1
* (TKnpl) initial commit

## What's next
* Adding more data points for informations in case of an active alert

## License
MIT License

Copyright (c) 2021 TKnpl <dev@t-concepts.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
