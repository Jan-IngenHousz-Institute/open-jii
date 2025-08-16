#!/usr/bin/env bash

set -e
set -u

function create_database() {
        local database=$1
        echo "Creating additional database '$database'"
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
            CREATE DATABASE $database;
            GRANT ALL PRIVILEGES ON DATABASE $database TO $POSTGRES_USER;
EOSQL
}

if [ -n "$POSTGRES_CREATE_ADDITIONAL_DATABASES" ]; then
  for db in $POSTGRES_CREATE_ADDITIONAL_DATABASES
  do
      create_database $db
  done
fi
