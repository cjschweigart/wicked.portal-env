FROM node:4

RUN apt-get update && apt-get install -y \
        wget \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

#ENV DOCKERIZE_VERSION v0.2.0
#RUN wget -nv https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
#    && tar -C /usr/local/bin -xzvf dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz

RUN mkdir -p /usr/src/portal-env /usr/src/app
COPY . /usr/src/portal-env
COPY package.all.json /usr/src/app/package.json

WORKDIR /usr/src/app
RUN cd ../portal-env && npm pack && mv portal-env-* ../portal-env.tgz && cd /usr/src/app
RUN npm install

# We install all node_modules in this base image; no need to do it later
# ONBUILD COPY package.json /usr/src/app/
# ONBUILD RUN npm install
ONBUILD RUN date -u "+%Y-%m-%d %H:%M:%S" > /usr/src/app/build_date
ONBUILD COPY . /usr/src/app

CMD [ "npm", "start" ]
