import os
import json

def byteify(input):
    if isinstance(input, dict):
        return {byteify(key): byteify(value)
                for key, value in input.iteritems()}
    elif isinstance(input, list):
        return [byteify(element) for element in input]
    elif isinstance(input, unicode):
        return input.encode('utf-8')
    else:
        return input
        
dirs = [
    'portal',
    'portal-api',
    'portal-chatbot',
    'portal-env',
    'portal-kong-adapter',
    'portal-mailer',
    'portal-kickstarter'    
]

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

allDependencies = {}

for dirName in dirs:
    dir = os.path.join(base_dir, dirName)
    
    print 'Checking packages in: ' + dirName
    
    with open(os.path.join(dir, 'package.json')) as json_package:
        package = byteify(json.loads(json_package.read()))
    
    #print json.dumps(package)
    if 'dependencies' in package:
        for depName in package['dependencies']:
            depVersion = package['dependencies'][depName]
            if not depName in allDependencies:
                allDependencies[depName] = depVersion
            elif depVersion != allDependencies[depName]:
                print 'WARNING: dependency version mismatch for "' + dirName + '": ' + depName + ' - ' + depVersion + ' vs. ' + allDependencies[depName]
                if depVersion > allDependencies[depName]:
                    print 'WARNING: Taking newer version: ' + depVersion
                    allDependencies[depName] = depVersion

with open(os.path.join(os.path.dirname(__file__), 'package.json')) as package_json:
    this_package = byteify(json.loads(package_json.read()))
this_package['dependencies'] = allDependencies
print 'Writing all dependencies to package.all.json.'
with open(os.path.join(os.path.dirname(__file__), 'package.all.json'), 'w') as all_package_json:
    json.dump(this_package, all_package_json, indent=2, sort_keys=True)
