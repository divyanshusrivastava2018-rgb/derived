# TLS for nginx (production)

Place your certificate files here:

- `cert.pem` — full chain (or server cert)
- `key.pem` — private key

Then use production nginx config:

```bash
NGINX_CONF=./nginx.conf docker compose up -d nginx
```

## Self-signed (local HTTPS testing only)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem \
  -subj "/CN=stream.researchium.com"
```
