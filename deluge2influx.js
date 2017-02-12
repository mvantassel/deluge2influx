'use strict';

const Influx = require('influx');
const request = require('request-promise');

const checkInterval = process.env.UPDATE_INTERVAL_MS || 1000 * 30;

const influxClient = new Influx.InfluxDB({
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

let authCookie;

let delugeRequestObj = {
    method: 'POST',
    url: `${delugeConfig.protocol}://${delugeConfig.host}:${delugeConfig.port}/json`,
    json: true,
    gzip: true,
    resolveWithFullResponse: true
};

function authDeluge() {
    return request(Object.assign(delugeRequestObj, {
        body: {
            method: 'auth.login',
            params: [delugeConfig.password],
            id: 1
        }
    }));
}

function getDelugeTorrents() {
    return request(Object.assign(delugeRequestObj, {
        headers: {
            'Cookie': authCookie
        },
        body: {
            method: 'web.update_ui',
            params: [
                ['name', 'total_size', 'state', 'progress', 'ratio', 'time_added', 'tracker_host', 'total_done', 'total_uploaded'],
                []
            ],
            id: 1
        }
    }));
}

function writeToInflux(seriesName, values, tags, callback) {
    return influxClient.writePoint(seriesName, values, tags, callback);
}

function onAuthDeluge(response) {
    authCookie = JSON.stringify(response.headers['set-cookie']).slice(2,50);
}

function onGetDelugeTorrents(response) {
    let torrents = response.body.result.torrents;
    let torrentKeys = Object.keys(torrents);

    let torrentsByState = {
        'Downloading': {
            count: 0,
            downloaded: 0,
            uploaded: 0
        },
        'Seeding': {
            count: 0,
            downloaded: 0,
            uploaded: 0
        }
    };

    torrentKeys.forEach(torrentKey => {
        let torrent = torrents[torrentKey];

        torrentsByState[torrent.state].count++;
        torrentsByState[torrent.state].downloaded += torrent.total_done;
        torrentsByState[torrent.state].uploaded += torrent.total_uploaded;

        let value = {
            name: torrent.name,
            progress: torrent.progress,
            size: torrent.total_size,
            ratio: torrent.ratio,
            downloaded: torrent.total_done,
            uploaded: torrent.total_uploaded
        };

        let tags = {
            state: torrent.state,
            tracker: torrent.tracker_host
        };

        writeToInflux('torrent', value, tags, function() {
            console.dir(`wrote ${torrents[torrentKey].name} torrent data to influx: ${new Date()}`);
        });
    });

    Object.keys(torrentsByState).forEach(state => {
        let value = {
            count: torrentsByState[state].count,
            downloaded: torrentsByState[state].downloaded,
            uploaded: torrentsByState[state].uploaded
        };

        let tags = {
            state: state
        };

        writeToInflux('torrents', value, tags, function() {
            console.dir(`wrote ${tags.state} torrent data to influx: ${new Date()}`);
        });
    });

}

function restart(err) {
    if (err) {
        console.log(err);
    }

    // Every {checkInterval} seconds
    setTimeout(getAllTheMetrics, checkInterval);
}

function getAllTheMetrics() {
    if (!authCookie) {
        authDeluge()
            .then(onAuthDeluge)
            .catch(restart)
            .then(getDelugeTorrents)
            .then(onGetDelugeTorrents)
            .finally(restart);
    } else {
        getDelugeTorrents()
            .then(onGetDelugeTorrents)
            .finally(restart);
    }
}

// Refresh the cookie every hour so it doesn't expire
setInterval(function() {
    authDeluge(onAuthDeluge);
}, 1000 * 60 * 60);

getAllTheMetrics();
