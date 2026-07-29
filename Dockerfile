# Pinned to alpine3.20 (not just "22-alpine") so the OS package repo still
# carries php82 - Alpine 3.24+ dropped it in favor of php83/84. This keeps the
# PHP runtime this image ships for WordPress builds unchanged while bumping
# only the Node runtime semantic-release needs (see the toolchain section below).
FROM node:22-alpine3.20

LABEL org.opencontainers.image.title="wp-dev-ci" \
    org.opencontainers.image.description="Public CI image for WordPress and PHP/Node build workflows" \
    org.opencontainers.image.source="https://github.com/viwiv-gmbh/wp-dev-ci" \
    org.opencontainers.image.licenses="MIT"

RUN apk add --no-cache \
    bash \
    curl \
    g++ \
    git \
    make \
    nginx \
    openssh \
    php82 \
    php82-cli \
    php82-common \
    php82-curl \
    php82-dom \
    php82-fileinfo \
    php82-fpm \
    php82-iconv \
    php82-json \
    php82-mbstring \
    php82-opcache \
    php82-openssl \
    php82-pdo \
    php82-pdo_mysql \
    php82-pdo_sqlite \
    php82-pecl-redis \
    php82-phar \
    php82-simplexml \
    php82-tokenizer \
    php82-xml \
    php82-xmlwriter \
    php82-zip \
    rsync \
    sqlite \
    supervisor \
    unzip \
    zip && \
        ln -sf /usr/bin/php82 /usr/bin/php

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

# ---------------------------------------------------------------------------
# WordPress semantic-release toolchain
#
# Consumer pipelines (WordPress plugins/themes/blocks using this image) must
# never run `npm install` for release tooling at CI time - that would let an
# unpinned transitive dependency change what a release does between builds.
# Instead semantic-release, its plugins, and this repo's validation/version
# scripts are baked in here once, at image-build time, pinned by
# package-lock.json. Consumer .gitlab-ci.yml jobs just call `semantic-release`
# or `node $WP_CI_SCRIPTS/<name>.mjs` directly against their own repo.
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
    && node -e "console.log('wp-ci scripts present:', require('node:fs').readdirSync(process.env.WP_CI_SCRIPTS).join(', '))"

WORKDIR /mount