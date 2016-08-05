'use strict';

var fs = require('fs');
var path = require('path');
var debug = require('debug')('portal-env:config-updater');

var updater = function() { };

var updateSteps = {
    1: updateStep1_June2016,
    2: updateStep2_June2016
};

updater.updateConfig = function (staticConfigPath, initialStaticConfigPath) {
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
            updateSteps[step](targetConfig, sourceConfig);
    }
};

function makeConfigPaths(basePath) {
    var globalsFile = path.join(basePath, 'globals.json');
    var apisDir = path.join(basePath, 'apis');
    var contentDir = path.join(basePath, 'content');
    var groupsDir = path.join(basePath, 'groups');
    var templatesDir = path.join(basePath, 'templates');
    var emailDir = path.join(templatesDir, 'email');
    
    return {
        basePath: basePath,
        globalsFile: globalsFile,
        apisDir: apisDir,
        contentDir: contentDir,
        groupsDir: groupsDir,
        templatesDir: templatesDir,
        emailDir: emailDir,
        chatbotTemplates: path.join(templatesDir, 'chatbot.json')
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

function copyTextFile(source, target) {
    debug('copyTextFile("' + source + '", "' + target + '")');
    fs.writeFileSync(target, fs.readFileSync(source, 'utf8'), 'utf8');
}

function copyFile(source, target) {
    debug('copyFile("' + source + '", "' + target + '")');
    fs.writeFileSync(target, fs.readFileSync(source));
}

function updateStep2_June2016(targetConfig, sourceConfig) {
    debug('Performing updateStep2_June2016()');

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

function updateStep1_June2016(targetConfig, sourceConfig) {
    debug('Performing updateStep1_June2016()');
    
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
    for (var i=0; i<emailTemplates.length; ++i) {
        var templateFileName = emailTemplates[i] + '.mustache';
        copyTextFile(path.join(sourceConfig.emailDir, templateFileName), path.join(targetConfig.emailDir, templateFileName));
    }
    
    saveGlobals(targetConfig, targetGlobals);
}

module.exports = updater;