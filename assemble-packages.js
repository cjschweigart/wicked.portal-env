'use strict';

var fs = require('fs');
var path = require('path');

var dirs = [
    'wicked.portal',
    'wicked.portal-api',
    'wicked.portal-chatbot',
    'wicked.portal-env',
    'wicked.portal-kong-adapter',
    'wicked.portal-mailer',
    'wicked.portal-kickstarter',
    'wicked.portal-test/portal-api',
    'wicked.portal-test/portal-kong-adapter'
];

var baseDir = path.resolve(path.join(__dirname, '..'));

var allDependencies = {};

for (var i=0; i<dirs.length; ++i) {
    var dirName = dirs[i];
    var dir = path.join(baseDir, dirName);
    console.log('Checking packages.json in: ' + dir);
    
    var pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json')));

    for(var depName in pkg.dependencies) {
        var depVersion = pkg.dependencies[depName];
        if (depVersion.startsWith('..'))
            continue;
        if (!allDependencies[depName])
            allDependencies[depName] = depVersion;
        else if (allDependencies[depName] != depVersion) {
            console.log('WARNING: Dependency version mismatch for "' + dirName + '": ' + depName + ' - ' + depVersion + ' vs. ' + allDependencies[depName]);
            if (depVersion > allDependencies[depName]) {
                console.log('WARNING: Taking newer version: ' + depVersion);
                allDependencies[depName] = depVersion;
            }
        }
    }    
}

// Re-add the portal-env we filtered out above
allDependencies['portal-env'] = '../portal-env.tgz';

var thisPackage = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
thisPackage.dependencies = allDependencies;

console.log(JSON.stringify(thisPackage, null, 2));

var allPackageFileName = path.join(__dirname, 'package.all.json');
console.log('Writing to ' + allPackageFileName); 
fs.writeFileSync(allPackageFileName, JSON.stringify(thisPackage, null, 2), 'utf8');
