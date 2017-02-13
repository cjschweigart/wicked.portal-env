FROM node:6

ENV GOSU_VERSION=1.10

RUN groupadd -r wicked --gid=888 && useradd -r -g wicked --uid=888 wicked
RUN wget -O /usr/local/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64 \
    && chmod +x /usr/local/bin/dumb-init
RUN set -x \
    && apt-get update && apt-get install -y --no-install-recommends ca-certificates wget && rm -rf /var/lib/apt/lists/* \
    && dpkgArch="$(dpkg --print-architecture | awk -F- '{ print $NF }')" \
    && wget -O /usr/local/bin/gosu "https://github.com/tianon/gosu/releases/download/$GOSU_VERSION/gosu-$dpkgArch" \
    && wget -O /usr/local/bin/gosu.asc "https://github.com/tianon/gosu/releases/download/$GOSU_VERSION/gosu-$dpkgArch.asc" \
    && export GNUPGHOME="$(mktemp -d)" \
    && gpg --keyserver ha.pool.sks-keyservers.net --recv-keys B42F6819007F00F88E364FD4036A9C25BF357DD4 \
    && gpg --batch --verify /usr/local/bin/gosu.asc /usr/local/bin/gosu \
    && rm -r "$GNUPGHOME" /usr/local/bin/gosu.asc \
    && chmod +x /usr/local/bin/gosu \
    && gosu nobody true
    
RUN mkdir -p /usr/src/portal-env /usr/src/app && chown -R wicked:wicked /usr/src && \
    mkdir -p /home/wicked && chown -R wicked:wicked /home/wicked

USER wicked
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
ONBUILD RUN if [ -d ".git" ]; then \
        git log -1 --decorate=short > /usr/src/app/git_last_commit && \
        git rev-parse --abbrev-ref HEAD > /usr/src/app/git_branch; \
    fi

ENTRYPOINT ["/usr/local/bin/dumb-init", "--"]
CMD ["npm", "start" ]
