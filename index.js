'use strict';

var mqtt = require('mqtt');
const fs = require('fs');
var jwt = require('jsonwebtoken');
const deviceId = `ElsysERS`;
const registryId = `Actility-Office-Lounge`;
const region = `europe-west1`;
const algorithm = `RS256`;
const privateKeyFile = `./keys/rsa_private.pem`;
const serverCertFile = `./keys/roots.pem`;
const mqttBridgeHostname = `mqtt.googleapis.com`;
const mqttBridgePort = 8883;
const messageType = `events`;
const projectId = "cloud-iot-330312";
const mqttClientId = `projects/${projectId}/locations/${region}/registries/${registryId}/devices/${deviceId}`;
let publishChainInProgress = false;

const publishAsync = (
    mqttTopic,
    client
) => {
    setTimeout(() => {
        function getRdnInteger(min, max) {
            return Math.floor(Math.random() * (max - min)) + min;
        }

        const temperature = getRdnInteger(-10, 30) + ' Celsius';
        var date = parseInt(Date.now() / 1000);
        const payload = deviceId + ";" + temperature + ";" + date;

        console.log("Publishing message: ", payload);
        client.publish(mqttTopic, payload, { qos: 1 });
        publishAsync(mqttTopic, client);
    }, 5000);
};

const createJwt = (projectId, privateKeyFile, algorithm) => {
    const token = {
        iat: parseInt(Date.now() / 1000),
        exp: parseInt(Date.now() / 1000) + 20 * 60, // 20 minutes
        aud: projectId,
    };
    const privateKey = fs.readFileSync(privateKeyFile);
    return jwt.sign(token, privateKey, { algorithm: algorithm });
};

const connectionArgs = {
    host: mqttBridgeHostname,
    port: mqttBridgePort,
    clientId: mqttClientId,
    username: 'unused',
    password: createJwt(projectId, privateKeyFile, algorithm),
    protocol: 'mqtts',
    secureProtocol: 'TLSv1_2_method',
    ca: [fs.readFileSync(serverCertFile)],
};

const client = mqtt.connect(connectionArgs);

client.subscribe(`/devices/${deviceId}/config`, { qos: 1 });
client.subscribe(`/devices/${deviceId}/commands/#`, { qos: 0 });

const mqttTopic = `/devices/${deviceId}/${messageType}`;

client.on('connect', success => {
    console.log('connect');
    if (!success) {
        console.log('Client not connected...');
    } else if (!publishChainInProgress) {
        publishAsync(mqttTopic, client);
    }
});

client.on('close', () => {
    console.log('close');
});

client.on('error', err => {
    console.log('error', err);
});

client.on('message', (topic, message) => {
    let messageStr = 'Message received: ';
    if (topic === `/devices/${deviceId}/config`) {
        messageStr = 'Config message received';
    } else if (topic.startsWith(`/devices/${deviceId}/commands`)) {
        messageStr = 'Command message received: ';
    }

    messageStr += Buffer.from(message, 'base64').toString('ascii');
    console.log(messageStr);
});