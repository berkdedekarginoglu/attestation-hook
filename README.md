# attestation-hook

Frida-based instrumentation script for observing Twitter Android's attestation pipeline at runtime.

## Features

- Hooks OkHttp request execution
- Extracts hidden request bodies from internal structures
- Decodes gzip responses
- Reveals attestation-related traffic invisible to MITM tools

## Usage

```bash
frida -U -f com.twitter.android -l interceptor.js --no-pause
