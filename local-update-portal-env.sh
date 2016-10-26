#!/bin/bash

# Use this file after you have made changes to portal-env which you need
# to propagate into the different packages. This is done by the build scripts
# automatically via portal-env being the base for all other docker images, but
# if you need to update locally, try this.

rm portal-env-*
rm ../portal-env.tgz

npm pack
mv portal-env-* ../portal-env.tgz
# npm cache add ../portal-env.tgz

for wickedDir in \
    "wicked.portal" \
    "wicked.portal-api" \
    "wicked.portal-kong-adapter" \
    "wicked.portal-kickstarter" \
    "portal" \
    "portal-api" \
    "portal-kong-adapter" \
    "portal-kickstarter"; do

    if [ -d "../$wickedDir" ]; then 
        echo Updating $wickedDir
        pushd ../$wickedDir > /dev/null && npm install ../portal-env.tgz && popd > /dev/null 
    fi
done

exit 1
