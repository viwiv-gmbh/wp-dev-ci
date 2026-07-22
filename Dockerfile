FROM node:21-alpine

LABEL org.opencontainers.image.title="wp-dev-ci" \
    org.opencontainers.image.description="Public CI image for WordPress and PHP/Node build workflows" \
    org.opencontainers.image.source="https://github.com/viwiv-gmbh/wp-dev-ci" \
    org.opencontainers.image.licenses="MIT"

RUN apk add --no-cache \
    bash \
    curl \
    g++ \
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