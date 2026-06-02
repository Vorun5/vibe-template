# TODO: pin to a specific Prometheus version before going to production.
# `latest` is convenient for the template but unpinned upstream changes will
# eventually break dashboards or scrape configs.
FROM prom/prometheus:latest
COPY prometheus.yml /etc/prometheus/prometheus.yml
