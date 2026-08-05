FROM prom/prometheus:v2.54.1

USER root
COPY prometheus.yml.template /etc/prometheus/prometheus.yml.template
COPY realtime-alerts.yml /etc/prometheus/realtime-alerts.yml
COPY entrypoint.sh /etc/prometheus/entrypoint.sh
RUN chmod 0555 /etc/prometheus/entrypoint.sh

ENTRYPOINT ["/bin/sh", "/etc/prometheus/entrypoint.sh"]
