FROM node:6

RUN wget -O /usr/local/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64 \
    && chmod +x /usr/local/bin/dumb-init

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
ONBUILD RUN if [ -d ".git" ]; then \
        git log -1 --decorate=short > /usr/src/app/git_last_commit && \
        git rev-parse --abbrev-ref HEAD > /usr/src/app/git_branch; \
    fi 

ENTRYPOINT ["/usr/local/bin/dumb-init", "--"]
CMD ["npm", "start" ]
