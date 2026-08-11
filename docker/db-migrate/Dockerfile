FROM postgres:17
COPY docker/db-migrate/entrypoint.sh /usr/local/bin/dashboard-db-migrate
RUN chmod 0555 /usr/local/bin/dashboard-db-migrate
ENTRYPOINT ["/usr/local/bin/dashboard-db-migrate"]
