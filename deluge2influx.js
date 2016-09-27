'use strict';

const influx = require('influx');
const request = require('request');

const checkInterval = process.env.UPDATE_INTERVAL_MS || 1000 * 30;

const influxClient = influx({
    host: process.env.INFLUX_HOST || 'localhost',
    port: process.env.INFLUX_PORT || 8086,
    protocol: process.env.INFLUX_PROTOCOL || 'http',
    database: process.env.INFLUX_DB || 'deluge'
});

const delugeConfig = {
    host: process.env.DELUGE_HOST || 'localhost',
    protocol: process.env.DELUGE_PROTOCOL ||'http',
    port: process.env.DELUGE_PORT || 8112,
    password: process.env.DELUGE_PASSWORD || 'deluge'
};

const delugeOptions = {
    url: `${delugeConfig.protocol}://${delugeConfig.host}:${delugeConfig.port}/json`
};

let authCookie;

function authDeluge(callback) {
    return request({
        method: 'POST',
        url: delugeOptions.url,
        json: true,
        gzip: true,
        body: {
            method: 'auth.login',
            params: [delugeConfig.password],
            id: 1
        }
    }, callback);
}

function getDelugeTorrents(callback) {
    return request({
        method: 'POST',
        url: delugeOptions.url,
        headers: {
            'Cookie': authCookie
        },
        json: true,
        gzip: true,
        body: {
            method: 'web.update_ui',
            params: [
                ["name", "total_size", "state", "progress", "ratio", "time_added", "tracker_host", "total_done", "total_uploaded"],
                []
            ],
            id: 1
        }
    }, callback);
}

function writeToInflux(seriesName, values, tags, callback) {
    return influxClient.writePoint(seriesName, values, tags, callback);
}

function onAuthDeluge(error, response, body) {
    authCookie = JSON.stringify(response.headers['set-cookie']).slice(2,50);
}

function onGetDelugeTorrents(error, response, body) {
    var torrents = body.result.torrents;
    var torrentKeys = Object.keys(torrents);

    torrentKeys.forEach(function(torrentKey) {
        let value = {
            added: torrents[torrentKey].time_added,
            name: torrents[torrentKey].name,
            progress: torrents[torrentKey].progress,
            size: torrents[torrentKey].total_size,
            ratio: torrents[torrentKey].ratio,
            downloaded: torrents[torrentKey].total_done,
            uploaded: torrents[torrentKey].total_uploaded
        };
        let tags = {
            state: torrents[torrentKey].state,
            tracker: torrents[torrentKey].tracker_host
        };

        writeToInflux('torrent', value, tags, function() {
            console.dir(`wrote ${torrents[torrentKey].name} torrent data to influx: ${new Date()}`);
        });
    });

    writeToInflux('torrents', {
        count: torrentKeys.length
    }, null, function() {
        console.dir(`wrote ${torrentKeys.length} torrents data to influx: ${new Date()}`);
    });
}

function getAllTheMetrics() {
    if (!authCookie) {
        authDeluge(onAuthDeluge);
    } else {
        getDelugeTorrents(onGetDelugeTorrents);
    }
}

// Refresh the cookie every hour so it doesn't expire
setInterval(function() {
    authDeluge(onAuthDeluge);
}, 1000 * 60 * 60);

// Every {checkInterval} seconds
getAllTheMetrics();
setInterval(getAllTheMetrics, checkInterval);
