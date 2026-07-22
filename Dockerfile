FROM node:21-alpine

LABEL org.opencontainers.image.title="wp-dev-ci" \
    org.opencontainers.image.description="Public CI image for WordPress and PHP/Node build workflows" \
    org.opencontainers.image.source="https://github.com/viwiv-gmbh/wp-dev-ci" \
    org.opencontainers.image.licenses="MIT"

RUN apk update && \
    apk add --no-cache bash

RUN apk update && \
    apk add --no-cache make g++ rsync openssh zip unzip curl sqlite nginx supervisor php82 php82-common php82-fpm php82-pdo php82-opcache php82-zip php82-phar php82-iconv php82-cli php82-curl php82-openssl php82-mbstring php82-tokenizer php82-fileinfo php82-json php82-xml php82-xmlwriter php82-simplexml php82-dom php82-pdo_mysql php82-pdo_sqlite php82-pecl-redis && \
    rm -rf /var/cache/apk/*

# RUN rm /usr/bin/php
RUN ln -s /usr/bin/php82 /usr/bin/php

RUN npm install -g npm@latest

RUN php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
RUN php -r "if (hash_file('sha384', 'composer-setup.php') === 'dac665fdc30fdd8ec78b38b9800061b4150413ff2e3b6f88543c636f7cd84f6db9189d43a81e5503cda447da73c7e5b6') { echo 'Installer verified'; } else { echo 'Installer corrupt'; unlink('composer-setup.php'); } echo PHP_EOL;"
RUN php composer-setup.php
RUN php -r "unlink('composer-setup.php');"
RUN mv composer.phar /usr/local/bin/composer

# # Ensure PHP extensions are loaded
RUN echo "extension=pdo.so" >> /etc/php82/php.ini && \
    echo "extension=pdo_mysql.so" >> /etc/php82/php.ini && \
    echo "extension=pdo_sqlite.so" >> /etc/php82/php.ini && \
    echo "extension=session.so" >> /etc/php82/php.ini && \
    echo "extension=tokenizer.so" >> /etc/php82/php.ini && \
    echo "extension=fileinfo.so" >> /etc/php82/php.ini