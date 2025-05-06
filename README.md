`docker build . -t psiegfried/rocket-theme-ci`  
`docker push psiegfried/rocket-theme-ci`


psiegfried/rocket-theme-ci-build:node-21
gitlab-runner exec shell push_dev --env "FTP_URL_MASTER=test"
docker run -it --rm -v "$(pwd)":/mount psiegfried/rocket-theme-ci-build:node-21 bash
 docker run -it --rm -v "$(pwd)":/mount psiegfried/rocket-theme-ci-build:node-21 bash

ext-pdo *
ext-session *
ext-tokenizer *
ext-fileinfo *
ext-tokenizer *



docker build . -t psiegfried/rocket-theme-ci-build:node-21-update --no-cache --platform linux/amd64
docker build . -t psiegfried/rocket-theme-ci-build:node-21-update --no-cache --platform linux/arm64


docker build . -t psiegfried/rocket-theme-ci-build:node-22-update --no-cache --platform linux/amd64
docker push psiegfried/rocket-theme-ci-build:node-22-update