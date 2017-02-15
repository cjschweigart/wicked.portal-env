'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var debug = require('debug')('portal-env:env-reader');
var request = require('request');
var uuid = require('node-uuid');

var configUpdater = require('./config-updater');
var cryptTools = require('./crypt-tools');

var envReader = function () { };

envReader.resolveStaticConfig = function() {
    debug('resolveStaticConfig():');
    var configDir;
    if (process.env.PORTAL_API_STATIC_CONFIG) {
        configDir = process.env.PORTAL_API_STATIC_CONFIG;
    } else if (process.env.PORTAL_CONFIG_BASE) {
        configDir = path.join(process.env.PORTAL_CONFIG_BASE, 'static');
    } else {
        configDir = '/var/portal-api/static';
    }
    var globalFile = path.join(configDir, 'globals.json');
    if (!fs.existsSync(globalFile))
        throw new Error('Could not resolve static configuration path; tried PORTAL_API_STATIC_CONFIG, checked PORTAL_CONFIG_BASE and /var/portal-api/static.');
    debug(configDir);
    return configDir;
};

envReader.getInitialConfigPath = function () {
    const configPath = path.join(__dirname, 'initial-config', 'static');
    debug('getInitialConfigPath(): ' + configPath);
    return configPath;
};

envReader.guessServiceUrl = function (defaultHost, defaultPort) {
    debug('guessServiceUrl() - defaultHost: ' + defaultHost + ', defaultPort: ' + defaultPort);
    var url = 'http://' + defaultHost + ':' + defaultPort + '/';
    // Are we not running on Linux? Then guess we're in local development mode.
    if (os.type() != 'Linux') {
        let defaultLocalIP = getDefaultLocalIP();
        url = 'http://' + defaultLocalIP + ':' + defaultPort + '/';
    }
    debug(url);
    return url;
};

envReader.resolveApiUrl = function() {
    var apiUrl = process.env.PORTAL_API_URL;
    if (!apiUrl) {
        apiUrl = envReader.guessServiceUrl('portal-api', '3001');
        console.log('Environment variable PORTAL_API_URL is not set, defaulting to ' + apiUrl + '. If this is not correct, please set before starting this process.');
    }
    if (!apiUrl.endsWith('/')) // Add trailing slash
        apiUrl += '/';
    return apiUrl;
};

envReader.updateConfig = function (staticConfigPath, initialStaticConfigPath) {
    debug('updateConfig() - Target: ' + staticConfigPath + ', Source: ' + initialStaticConfigPath);
    configUpdater.updateConfig(staticConfigPath, initialStaticConfigPath);
};

envReader.checkEnvironment = function (staticConfigPath, keyText, envName) {
    debug('checkEnvironment() - ' + staticConfigPath + ', env: ' + envName);
    if (!keyText)
        console.log('INFO: No key was passed to checkEnvironment; can only read plain text content.');
    console.log('Reading config from: ' + staticConfigPath);

    if ('default' !== envName)
        loadEnvironment(staticConfigPath, keyText, envName);
    loadEnvironment(staticConfigPath, keyText, 'default');

    // Assign local IP to special env var, if not running in Docker
    if (!process.env.WICKED_IN_DOCKER) {
        var localIpAddress = getDefaultLocalIP();
        
        // These variable names need to be "registered" in portal-kickstarter:utils.js 
        if (!process.env.LOCAL_IP)
            process.env.LOCAL_IP = localIpAddress;
        if (!process.env.LOCAL_API_HOST)
            process.env.LOCAL_API_HOST = localIpAddress + ':8000';
        if (!process.env.LOCAL_PORTAL_HOST)
            process.env.LOCAL_PORTAL_HOST = localIpAddress + ':3000';
        if (!process.env.LOCAL_PORTAL_URL)
            process.env.LOCAL_PORTAL_URL = 'http://' + localIpAddress + ':3000';
        if (!process.env.LOCAL_API_URL)
            process.env.LOCAL_API_URL = 'http://' + localIpAddress + ':3001';
    }

    // Sanity check: Does PORTAL_API_STATIC_CONFIG match staticConfigPath?
    // If not, you have some configuration mismatch you should check on.
    if (process.env.PORTAL_API_STATIC_CONFIG != staticConfigPath)
        throw new Error('portal-env:checkEnvironment() - The environment variable PORTAL_API_STATIC_CONFIG does not match the resolved configuration path. Please change the environment files, or pass in the correct path to the static configuration using a pre-set environment variable PORTAL_API_STATIC_CONFIG: ' + process.env.PORTAL_API_STATIC_CONFIG + ' vs. ' + staticConfigPath);
};

function hasEnvVars(s) {
    return s.startsWith('$') || (s.indexOf('${') >= 0);
}

function replaceEnvVarsInString(s) {
    var tempString = "" + s;
    var foundVar = hasEnvVars(tempString);
    var iterCount = 0;
    while (foundVar) {
        iterCount++;
        if (iterCount > 10) {
            console.error('Detected recursive use of env variables.');
            console.error('Original string: ' + s);
            console.error('Current string : ' + tempString);
            return tempString;
        }
        if (tempString.startsWith('$') &&
            !tempString.startsWith("${")) {
            let envVarName = tempString.substring(1);
            if (process.env[envVarName]) {
                debug('Replacing ' + envVarName + ' with "' + process.env[envVarName] + '" in "' + tempString + '".' );
                tempString = process.env[envVarName];
            }
        } else {
            // Inline env var ${...}
            var envRegExp = /\$\{([A-Za-z\_0-9]+)\}/g; // match ${VAR_NAME}
            var match = envRegExp.exec(tempString);
            if (match) {
                let envVarName = match[1]; // Capture group 1
                // Replace regexp with value of env var
                if (process.env[envVarName]) {
                    debug('Replacing ' + envVarName + ' with "' + process.env[envVarName] + '" in "' + tempString + '".' );
                    tempString = tempString.replace(match[0], process.env[envVarName]);
                }
            }
        }
        // Possibly recurse
        foundVar = hasEnvVars(tempString);
    }
    return tempString;
}

function loadEnvironment(staticConfigPath, keyText, envName) {
    debug('loadEnvironment() - ' + staticConfigPath);
    var envFileName = path.join(staticConfigPath, 'env', envName + '.json');
    if (!fs.existsSync(envFileName))
        throw new Error('portal-env: Could not find environment file: ' + envFileName);
    var envFile = JSON.parse(fs.readFileSync(envFileName, 'utf8'));
    for (var varName in envFile) {
        if (process.env[varName]) {
            console.log('Environment variable ' + varName + ' is already set. Skipping in this configuration.');
            continue;
        }
        var varProps = envFile[varName];
        var varValue = varProps.value;
        if (varProps.encrypted) {
            if (!keyText)
                throw new Error('Cannot decrypt variable ' + varName + ', key was not supplied.');
            varValue = cryptTools.apiDecrypt(keyText, varValue);
        }
        process.env[varName] = varValue;
    }

    // This has to be done already now to be able to resolve the data directories.
    if (process.env.PORTAL_API_DYNAMIC_CONFIG)
        process.env.PORTAL_API_DYNAMIC_CONFIG = replaceEnvVarsInString(process.env.PORTAL_API_DYNAMIC_CONFIG);  
    if (process.env.PORTAL_API_STATIC_CONFIG)
        process.env.PORTAL_API_STATIC_CONFIG = replaceEnvVarsInString(process.env.PORTAL_API_STATIC_CONFIG);  
}

envReader.sanityCheckDir = function (dirName) {
    debug('sanityCheckDir() - ' + dirName);
    // Pre-fill some vars we always need
    var envDict = {
        PORTAL_API_STATIC_CONFIG: ['(implicit)'],
        PORTAL_API_DYNAMIC_CONFIG: ['(implicit)'],
        PORTAL_API_URL: ['(implicit)'],
        PORTAL_PORTAL_URL: ['(implicit)'],
        PORTAL_KONG_ADAPTER_URL: ['(implicit)'],
        PORTAL_KONG_ADMIN_URL: ['(implicit)'],
        PORTAL_MAILER_URL: ['(implicit)'],
        PORTAL_CHATBOT_URL: ['(implicit)']
    };
    envReader.gatherEnvVarsInDir(dirName, envDict);

    var returnValue = true;
    var usedVars = {};
    // Check if every env var is set
    for (let envVarName in envDict) {
        if (!process.env.hasOwnProperty(envVarName)) {
            returnValue = false;
            console.error('Environment variable "' + envVarName + '" is not defined, but used in the following files:');
            var files = envDict[envVarName];
            for (var i = 0; i < files.length; ++i)
                console.error(' * ' + files[i]);
        } else {
            usedVars[envVarName] = true;
            console.log('Checking env var ' + envVarName + ': OK');
        }
    }

    for (let envVarName in process.env) {
        if (!envVarName.startsWith('PORTAL_'))
            continue;
        if (usedVars[envVarName])
            continue;
        if (envVarName == 'PORTAL_API_AESKEY')
            continue;
        console.log('WARNING: Environment variable ' + envVarName + ' is defined but never used.');
    }
    return returnValue;
};

// Target format:
// {
//   "PORTAL_NETWORK_SCHEMA": [ "/Users/hellokitty/Projects/config/static/global.json" ],   
//   "PORTAL_API_USERS_APIURL": [ "/Users/hellokitty/Projects/config/static/apis/users/config.json" ],   
// }
envReader.gatherEnvVarsInDir = function (dirName, envDict) {
    debug('gatherEnvVarsInDir(): ' + dirName);
    var fileNames = fs.readdirSync(dirName);
    for (var i = 0; i < fileNames.length; ++i) {
        var fileName = path.join(dirName, fileNames[i]);
        var stat = fs.statSync(fileName);
        if (stat.isFile() && fileName.endsWith('.json')) {
            gatherEnvVarsInFile(fileName, envDict);
        } else if (stat.isDirectory()) {
            envReader.gatherEnvVarsInDir(fileName, envDict);
        }
    }
};

function gatherEnvVarsInFile(fileName, envDict) {
    debug('gatherEnvVarsInFile() - ' + fileName);
    var ob = JSON.parse(fs.readFileSync(fileName, 'utf8'));
    gatherEnvVarsInObject(fileName, ob, envDict);
}

function gatherEnvVarsInObject(fileName, ob, envDict) {
    var pushProperty = function (propName) {
        if (envDict.hasOwnProperty(propName))
            envDict[propName].push(fileName);
        else
            envDict[propName] = [fileName];
    };
    for (var propName in ob) {
        var propValue = ob[propName];
        if (typeof propValue == "string" &&
            propValue.startsWith("$") &&
            !propValue.startsWith("${")) {
            var envVarName = propValue.substring(1);
            pushProperty(envVarName);
        } else if (typeof propValue == "string" &&
                   (propValue.indexOf('${') >= 0)) {
            var envRegExp = /\$\{([A-Za-z\_0-9]+)\}/g; // match ${VAR_NAME}
            var match = envRegExp.exec(propValue);
            while (match) {
                pushProperty(match[1]); // Capturing group 1
                match = envRegExp.exec(propValue);
            }
        } else if (typeof propValue == "object") {
            gatherEnvVarsInObject(fileName, propValue, envDict);
        }
    }
}

const _TIMEOUT = 2000;
function tryGet(url, maxTries, tryCounter, timeout, callback) {
    debug('Try #' + tryCounter + ' to GET ' + url + ' (timeout: ' + _TIMEOUT + 'ms)');
    request.get({ url: url, timeout: _TIMEOUT }, function (err, res, body) {
        var isOk = true;
        if (err || res.statusCode != 200) {
            if (tryCounter < maxTries || maxTries < 0)
                return setTimeout(tryGet, timeout, url, maxTries, tryCounter + 1, timeout, callback);
            debug('Giving up.');
            return callback(err);
        }
        callback(null, body);
    });
}

envReader.awaitUrl = function (url, tries, timeout, callback) {
    debug('awaitUrl(): ' + url);
    if (!callback)
        throw new Error('envReader.awaitUrl: callback is mandatory.');
    tryGet(url, tries, 1, timeout, callback);
};

function getDefaultLocalIP() {
    let localIPs = getLocalIPs();
    if (localIPs.length > 0)
        return localIPs[0];
    return "localhost";
}

function getLocalIPs() {
    debug('getLocalIPs()');
    var interfaces = os.networkInterfaces();
    var addresses = [];
    for (var k in interfaces) {
        for (var k2 in interfaces[k]) {
            var address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    debug(addresses);
    return addresses;
}

envReader.Crypt = cryptTools;

// ===== CorrelationIdHandler =====

envReader.CorrelationIdHandler = function() {
    return function (req, res, next) {
        var correlationId = req.get('correlation-id');
        if (correlationId) {
            req.correlationId = correlationId; 
            return next();
        }

        req.correlationId = uuid.v4();
        return next();
    };
};

module.exports = envReader;
