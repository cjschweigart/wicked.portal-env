'use strict';

var fs = require('fs');
var path = require('path');
var debug = require('debug')('portal-env:config-updater');
var cryptTools = require('./crypt-tools');

var updater = function () { };

var updateSteps = {
    1: updateStep1_June2016,
    2: updateStep2_June2016,
    3: updateStep3_Oct2016,
    4: updateStep4_Mar2017,
    5: updateStep5_Apr2017,
    6: updateStep6_Aug2017,
    10: updateStep10_v1_0_0
};

updater.updateConfig = function (staticConfigPath, initialStaticConfigPath, configKey) {
    debug('updateConfig() - Target: ' + staticConfigPath + ', Source: ' + initialStaticConfigPath);
    var targetConfig = makeConfigPaths(staticConfigPath);
    var sourceConfig = makeConfigPaths(initialStaticConfigPath);

    var targetGlobals = JSON.parse(fs.readFileSync(targetConfig.globalsFile));
    var currentVersion = 0;
    if (targetGlobals.version)
        currentVersion = targetGlobals.version;

    debug('Starting at config version: ' + currentVersion);

    for (var step in updateSteps) {
        if (currentVersion < step)
            updateSteps[step](targetConfig, sourceConfig, configKey);
    }

    verifyConfigKey(staticConfigPath, configKey);
};

function verifyConfigKey(staticConfigPath, configKey) {
    const globalData = JSON.parse(fs.readFileSync(path.join(staticConfigPath, 'globals.json'), 'utf8'));
    if (globalData.configKeyCheck) {
        const configKeyCheck = cryptTools.apiDecrypt(configKey, globalData.configKeyCheck);
        const wickedCheckText = configKeyCheck.substring(40);
        if (wickedCheckText !== 'wicked')
            throw Error('Property configKeyCheck in globals.json did not contain expected check string; is your PORTAL_CONFIG_KEY wrong?.');
        debug('updateConfig() - config key verified correct.');
    }
}

function makeConfigPaths(basePath) {
    debug('makeConfigPaths() - ' + basePath);
    var globalsFile = path.join(basePath, 'globals.json');
    var apisDir = path.join(basePath, 'apis');
    var contentDir = path.join(basePath, 'content');
    var groupsDir = path.join(basePath, 'groups');
    var templatesDir = path.join(basePath, 'templates');
    var emailDir = path.join(templatesDir, 'email');
    var plansFile = path.join(basePath, 'plans', 'plans.json');
    var authServersDir = path.join(basePath, 'auth-servers');

    return {
        basePath: basePath,
        globalsFile: globalsFile,
        apisDir: apisDir,
        contentDir: contentDir,
        groupsDir: groupsDir,
        templatesDir: templatesDir,
        emailDir: emailDir,
        chatbotTemplates: path.join(templatesDir, 'chatbot.json'),
        plansFile: plansFile,
        authServersDir: authServersDir
    };
}

function loadGlobals(config) {
    debug('loadGlobals() - ' + config.globalsFile);
    return JSON.parse(fs.readFileSync(config.globalsFile, 'utf8'));
}

function saveGlobals(config, glob) {
    debug('saveGlobals() - ' + config.globalsFile);
    fs.writeFileSync(config.globalsFile, JSON.stringify(glob, null, 2), 'utf8');
}

function loadApis(config) {
    debug('loadApis() - ' + config.apisDir);
    return JSON.parse(fs.readFileSync(path.join(config.apisDir, 'apis.json'), 'utf8'));
}

function saveApis(config, apiDefs) {
    debug('saveApis() - ' + config.apisDir);
    fs.writeFileSync(path.join(config.apisDir, 'apis.json'), JSON.stringify(apiDefs, null, 2), 'utf8');
}

function getApiConfigFileName(config, apiId) {
    return path.join(config.apisDir, apiId, 'config.json');
}

function loadApiConfig(config, apiId) {
    debug('loadApiConfig() - ' + config.apisDir + ', API ' + apiId);
    return JSON.parse(fs.readFileSync(getApiConfigFileName(config, apiId), 'utf8'));
}

function saveApiConfig(config, apiId, apiConfig) {
    debug('saveApiConfig() - ' + config.apisDir + ', API ' + apiId);
    debug('apiConfig.api:');
    debug(apiConfig.api);
    debug('apiConfig.plugins:');
    debug(apiConfig.plugins);
    fs.writeFileSync(getApiConfigFileName(config, apiId), JSON.stringify(apiConfig, null, 2), 'utf8');
}

function loadPlans(config) {
    debug('loadPlans() - ' + config.plansFile);
    return JSON.parse(fs.readFileSync(config.plansFile, 'utf8'));
}

function savePlans(config, plans) {
    debug('savePlans() - ' + config.plansFile);
    debug(plans);
    fs.writeFileSync(config.plansFile, JSON.stringify(plans, null, 2));
}

function copyTextFile(source, target) {
    debug('copyTextFile("' + source + '", "' + target + '")');
    fs.writeFileSync(target, fs.readFileSync(source, 'utf8'), 'utf8');
}

function copyFile(source, target) {
    debug('copyFile("' + source + '", "' + target + '")');
    fs.writeFileSync(target, fs.readFileSync(source));
}

function loadAuthServerList(config) {
    var authServerDir = config.authServersDir;
    debug('loadAuthServerList("' + authServerDir + '"');
    debug('Checking directory ' + authServerDir + ' for auth servers.');
    if (!fs.existsSync(authServerDir)) {
        debug('No auth servers defined.');
        return [];
    } else {
        const fileNames = fs.readdirSync(authServerDir);
        const serverNames = [];
        for (let i = 0; i < fileNames.length; ++i) {
            const fileName = fileNames[i];
            if (fileName.endsWith('.json')) {
                const authServerName = fileName.substring(0, fileName.length - 5);
                debug('Found auth server ' + authServerName);
                serverNames.push(authServerName); // strip .json
            }
        }
        return serverNames;
    }
}

function loadAuthServer(config, authServerId) {
    debug('loadAuthServer("' + authServerId + '")');
    return JSON.parse(fs.readFileSync(path.join(config.authServersDir, authServerId + '.json')));
}

function saveAuthServer(config, authServerId, authServer) {
    debug('saveAuthServer() - ' + authServerId);
    fs.writeFileSync(path.join(config.authServersDir, authServerId + '.json'), JSON.stringify(authServer, null, 2));
}

/**
 * Adapt the scopes configuration inside API definitions to include
 * descriptions (default to the name of the scope for now).
 */
function updateStep10_v1_0_0(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep6_Aug2017()');

    const targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 10;

    const apis = loadApis(targetConfig);
    let needsSaving = false;
    for (let i = 0; i < apis.apis.length; ++i) {
        const api = apis.apis[i];
        if (api.auth !== 'oauth2')
            continue;
        if (api.settings) {
            if (api.settings.scopes) {
                const newScopes = {};
                for (let scope in api.settings.scopes) {
                    newScopes[scope] = { description: scope };
                }
                api.settings.scopes = newScopes;
                needsSaving = true;
            }
        }
    }

    if (needsSaving) {
        saveApis(targetConfig, apis);
    }

    saveGlobals(targetConfig, targetGlobals);
}

/**
 * Adapt the Kong configuration of the APIs to the new Kong API as of
 * Kong 0.10.x, most notably change request_uri to an array uris and
 * map strip_request_path to strip_uri.
 * 
 * Add a new section sessionStore to globals, prefill with 'file'.
 */
function updateStep6_Aug2017(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep6_Aug2017()');

    var targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 6;

    var updateApiConfig = function (cfg) {
        if (cfg.request_path) {
            cfg.uris = [cfg.request_path]; // wrap in array
            delete cfg.request_path;
        }
        if (cfg.hasOwnProperty('strip_request_path')) {
            cfg.strip_uri = cfg.strip_request_path;
            delete cfg.strip_request_path;
        }
        if (!cfg.hasOwnProperty('http_if_terminated')) {
            cfg.http_if_terminated = true;
        }
        return cfg;
    };

    // Kong API change (tsk tsk, don't do that, please)
    // Change all request_path and strip_request_path occurrances
    // to uris and strip_uris.
    const apis = loadApis(targetConfig);
    for (let i = 0; i < apis.apis.length; ++i) {
        const apiConfig = loadApiConfig(targetConfig, apis.apis[i].id);
        let needsSaving = false;
        // Look for "api.request_path"
        if (apiConfig && apiConfig.api) {
            apiConfig.api = updateApiConfig(apiConfig.api);
            needsSaving = true;
        }
        if (needsSaving) {
            debug('API ' + apis.apis[i].id + ' updated.');
            debug(apiConfig.api);
            saveApiConfig(targetConfig, apis.apis[i].id, apiConfig);
            debug('Reloaded: ');
            debug(loadApiConfig(targetConfig, apis.apis[i].id).api);
        }
    }

    // Also check all Authorization Servers for this setting; these also
    // have a request_path set which needs to be mapped to a uris array.
    var authServers = loadAuthServerList(targetConfig);
    for (let i = 0; i < authServers.length; ++i) {
        var authServerId = authServers[i];
        var authServer = loadAuthServer(targetConfig, authServerId);
        if (authServer.config && authServer.config.api) {
            authServer.config.api = updateApiConfig(authServer.config.api);
            saveAuthServer(targetConfig, authServerId, authServer);
        }
    }

    if (!targetGlobals.sessionStore) {
        debug('Adding a default sessionStore property.');
        targetGlobals.sessionStore = {
            type: 'file',
            host: 'portal-redis',
            port: 6379,
            password: ''
        };
    }

    saveGlobals(targetConfig, targetGlobals);
}

/**
 * Add options in globals.json to allow
 *  - customization of the layout by the end user
 *  - edition of some views title tagline
 *  - force the redirect to HTTPS
 */
function updateStep5_Apr2017(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep5_Apr2017()');

    var targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 5;

    // Add layouts options
    targetGlobals.layouts = {
        defautRootUrl: 'http://wicked.haufe.io',
        defautRootUrlTarget: '_blank',
        defautRootUrlText: null,
        menu: {
            homeLinkText: 'Home',
            apisLinkVisibleToGuest: true,
            applicationsLinkVisibleToGuest: true,
            contactLinkVisibleToGuest: true,
            contentLinkVisibleToGuest: true,
            classForLoginSignupPosition: 'left',
            showSignupLink: true,
            loginLinkText: 'Log in'
        },
        footer: {
            showBuiltBy: true,
            showBuilds: true
        },
        swaggerUi: {
            menu: {
                homeLinkText: 'Home',
                showContactLink: true,
                showContentLink: false
            }
        }
    };

    // Add views options
    targetGlobals.views = {
        apis: {
            showApiIcon: true,
            titleTagline: 'This is the index of APIs which are available for this API Portal.'
        },
        applications: {
            titleTagline: 'This page displays all your registered applications. \
It also allows you to register a new application.'
        },
        application: {
            titleTagline: 'This page lets you administer the owners of this application. You can add and remove \
co-owners of the application. New co-owners must be already be registered in the portal \
in order to make them co-owners of the application.'
        }
    };

    // Add option to force redirection to HTTPS when website is called in HTTP
    targetGlobals.network.forceRedirectToHttps = false;

    // Save new changes
    saveGlobals(targetConfig, targetGlobals);
}

function updateStep4_Mar2017(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep4_Mar2017()');

    var targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 4;

    // This is a checksum to ensure we are using the same config_key when editing
    // and deploying
    const salt = cryptTools.createRandomId();
    targetGlobals.configKeyCheck = cryptTools.apiEncrypt(configKey, salt + 'wicked');

    saveGlobals(targetConfig, targetGlobals);
}

function updateStep3_Oct2016(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep3_Oct2016()');
    // configKey is not used here

    var targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 3;

    // Kong API change (tsk tsk, don't do that, please)
    // Change all rate-limiting and response-ratelimiting plugins, rename
    // continue_on_error to fault_tolerant and remove async.
    const apis = loadApis(targetConfig);
    for (let i = 0; i < apis.apis.length; ++i) {
        const apiConfig = loadApiConfig(targetConfig, apis.apis[i].id);
        let needsSaving = false;
        // Look for "rate-limiting" plugin (if we have plugins)
        if (apiConfig && apiConfig.plugins) {
            for (let plugin = 0; plugin < apiConfig.plugins.length; ++plugin) {
                const apiPlugin = apiConfig.plugins[plugin];
                if (oct2016_updatePlugin(apiPlugin))
                    needsSaving = true;
            }
        }
        if (needsSaving) {
            debug('API ' + apis.apis[i].id + ' updated: Plugins:');
            debug(apiConfig.plugins);
            saveApiConfig(targetConfig, apis.apis[i].id, apiConfig);
            debug('Reloaded: ');
            debug(loadApiConfig(targetConfig, apis.apis[i].id).plugins);
        }
    }

    const plans = loadPlans(targetConfig);
    let planNeedsSaving = false;
    for (let i = 0; i < plans.plans.length; ++i) {
        const plan = plans.plans[i];
        if (plan.config && plan.config.plugins) {
            for (let plugin = 0; plugin < plan.config.plugins.length; ++plugin) {
                const planPlugin = plan.config.plugins[plugin];
                if (oct2016_updatePlugin(planPlugin))
                    planNeedsSaving = true;
            }
        }
    }
    if (planNeedsSaving) {
        debug('Plans updated:');
        debug(plans);
        savePlans(targetConfig, plans);
    }

    // Part two: Make oauth2 settings explicit
    let apisNeedSave = false;
    for (let i = 0; i < apis.apis.length; ++i) {
        const thisApi = apis.apis[i];
        if (thisApi.auth && thisApi.auth == 'oauth2') {
            if (!thisApi.settings) {
                thisApi.settings = {
                    token_expiration: 3600
                };
            } else if (!thisApi.settings.token_expiration) {
                thisApi.settings.token_expiration = 3600;
            }
            if (!thisApi.settings.enable_implicit_grant)
                thisApi.settings.enable_client_credentials = true;
            apisNeedSave = true;
        }
    }
    if (apisNeedSave)
        saveApis(targetConfig, apis);

    saveGlobals(targetConfig, targetGlobals);
}

function oct2016_updatePlugin(apiPlugin) {
    let changedSomething = false;
    if (apiPlugin.name !== 'rate-limiting' &&
        apiPlugin.name !== 'response-ratelimiting')
        return false;
    if (apiPlugin.config && apiPlugin.config.hasOwnProperty('continue_on_error')) {
        const fault_tolerant = apiPlugin.config.continue_on_error;
        delete apiPlugin.config.continue_on_error;
        apiPlugin.config.fault_tolerant = fault_tolerant;
        changedSomething = true;
    }
    if (apiPlugin.config && apiPlugin.config.hasOwnProperty('async')) {
        delete apiPlugin.config.async;
        changedSomething = true;
    }
    return changedSomething;
}

function updateStep2_June2016(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep2_June2016()');
    // configKey not used here

    var targetGlobals = loadGlobals(targetConfig);
    targetGlobals.version = 2;

    // Add two PNG files
    copyFile(path.join(sourceConfig.contentDir, 'images', 'wicked-40.png'), path.join(targetConfig.contentDir, 'images', 'wicked-40.png'));
    copyFile(path.join(sourceConfig.contentDir, 'images', 'wicked-auth-page-120.png'), path.join(targetConfig.contentDir, 'images', 'wicked-auth-page-120.png'));

    // Privacy statement and Terms and Conditions
    copyTextFile(path.join(sourceConfig.contentDir, 'terms-and-conditions.jade'), path.join(targetConfig.contentDir, 'terms-and-conditions.jade'));
    copyTextFile(path.join(sourceConfig.contentDir, 'terms-and-conditions.json'), path.join(targetConfig.contentDir, 'terms-and-conditions.json'));
    copyTextFile(path.join(sourceConfig.contentDir, 'privacy-policy.jade'), path.join(targetConfig.contentDir, 'privacy-policy.jade'));
    copyTextFile(path.join(sourceConfig.contentDir, 'privacy-policy.json'), path.join(targetConfig.contentDir, 'privacy-policy.json'));

    // Pre-fill the company with the title
    targetGlobals.company = targetGlobals.title;

    saveGlobals(targetConfig, targetGlobals);
}

function updateStep1_June2016(targetConfig, sourceConfig, configKey) {
    debug('Performing updateStep1_June2016()');
    // configKey not used here

    var targetGlobals = loadGlobals(targetConfig);
    // This is for version 1
    targetGlobals.version = 1;

    // Add kickstarter.json
    copyTextFile(path.join(sourceConfig.basePath, 'kickstarter.json'), path.join(targetConfig.basePath, 'kickstarter.json'));

    // Add the templates
    if (!fs.existsSync(targetConfig.templatesDir))
        fs.mkdirSync(targetConfig.templatesDir);
    if (!fs.existsSync(targetConfig.emailDir))
        fs.mkdirSync(targetConfig.emailDir);

    copyTextFile(sourceConfig.chatbotTemplates, targetConfig.chatbotTemplates);
    var emailTemplates = [
        'lost_password',
        'pending_approval',
        'verify_email'
    ];
    for (var i = 0; i < emailTemplates.length; ++i) {
        var templateFileName = emailTemplates[i] + '.mustache';
        copyTextFile(path.join(sourceConfig.emailDir, templateFileName), path.join(targetConfig.emailDir, templateFileName));
    }

    saveGlobals(targetConfig, targetGlobals);
}

module.exports = updater;
