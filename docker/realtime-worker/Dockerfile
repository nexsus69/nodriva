FROM curlimages/curl:8.10.1

COPY realtime-worker.sh /usr/local/bin/realtime-worker
USER root
RUN chmod 0555 /usr/local/bin/realtime-worker
USER curl_user

ENTRYPOINT ["/usr/local/bin/realtime-worker"]
