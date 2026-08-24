# Debian Bookworm provides PHP 8.2 while allowing the Node runtime to be pinned
# to the exact patch release required by the semantic-release toolchain.
FROM node:22.23.1-bookworm-slim

LABEL org.opencontainers.image.title="wp-dev-ci" \
    org.opencontainers.image.description="Public CI image for WordPress and PHP/Node build workflows" \
    org.opencontainers.image.source="https://github.com/viwiv-gmbh/wp-dev-ci" \
    org.opencontainers.image.licenses="MIT"

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        g++ \
        git \
        make \
        nginx \
        openssh-client \
        php8.2-cli \
        php8.2-common \
        php8.2-curl \
        php8.2-fpm \
        php8.2-mbstring \
        php8.2-mysql \
        php8.2-opcache \
        php8.2-redis \
        php8.2-sqlite3 \
        php8.2-xml \
        php8.2-zip \
        rsync \
        sqlite3 \
        supervisor \
        unzip \
        zip \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/php8.2 /usr/bin/php

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

# ---------------------------------------------------------------------------
# WordPress semantic-release toolchain
#
# Consumer pipelines (WordPress plugins/themes/blocks using this image) must
# never run `npm install` for release tooling at CI time - that would let an
# unpinned transitive dependency change what a release does between builds.
# Instead semantic-release, its plugins, and this repo's validation, versioning,
# packaging, and updater scripts are baked in here once, at image-build time,
# pinned by package-lock.json. Consumer jobs call `semantic-release`,
# `node $WP_CI_SCRIPTS/<name>.mjs`, or `bash $WP_CI_SCRIPTS/<name>.sh`
# directly against their own repository.
# ---------------------------------------------------------------------------
WORKDIR /opt/wp-ci
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY scripts/ ./scripts/

ENV PATH="/opt/wp-ci/node_modules/.bin:${PATH}" \
    WP_CI_SCRIPTS="/opt/wp-ci/scripts"

# Fails the image build immediately if the toolchain is broken, instead of
# failing inside every consumer pipeline that pulls this tag.
RUN semantic-release --version \
    && bash -n scripts/*.sh \
    && node -e "console.log('wp-ci scripts present:', require('node:fs').readdirSync(process.env.WP_CI_SCRIPTS).join(', '))"

WORKDIR /mount
