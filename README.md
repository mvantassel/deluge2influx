# deluge2influx
Pipe Deluge metrics to InfluxDB

Most basic form:

    docker run -d mvantassel/deluge2influx


# Configuration (ENV, -e)

Variable | Description | Default value | Sample value | Required?
-------- | ----------- | ------------- | ------------ | ---------
INFLUXDB_PROTOCOL | Is Influx SSL? | http | https | optional
INFLUXDB_HOST | Where is your InfluxDB running? | localhost | influxdb | recommended
INFLUXDB_PORT | What port is InfluxDB running on? | 8086 | 999 | optional
INFLUXDB_DB | What InfluxDB database do you want to use? | 'deluge' | 'potato' | required
INFLUXDB_USER | InfluxDB username | | | optional
INFLUXDB_PASS | InfluxDB password | metrics | | optional
DELUGE_PROTOCOL | Is Deluge SSL? | http | https | optional
DELUGE_HOST | Where is your Deluge running? | localhost | deluge | recommended
DELUGE_PORT | What port is Deluge running on? | 8112 | 999 | optional
DELUGE_PASSWORD | What port is Deluge running on? | 'deluge' | 'potato' | optional
UPDATE_INTERVAL_MS | How often should it check for new metrics? | 30000 | 1000 | optional

## Tags

- latest
