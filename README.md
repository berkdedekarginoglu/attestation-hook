# Breaking the Black Box

Frida-based runtime instrumentation for observing Android attestation pipelines from inside the application layer.

---

## Key Insight

Modern mobile attestation does not happen over the network.

It happens inside the device:

- via Binder IPC  
- inside privileged system processes  
- using hardware-backed keys  

---

## Features

- Hooks OkHttp at execution layer (`RealCall.execute`)
- Extracts hidden request bodies from internal structures
- Decodes compressed responses (gzip)
- Reveals attestation traffic (nonce, tokens, integrity calls)

---

## Usage
```bash
frida -U -f com.twitter.android -l interceptor.js
```

---

## Why This Matters

SSL pinning bypass is not enough.  
If your proxy can't see it, you're looking at the wrong layer.

---

## How It Works

This approach instruments the application at runtime instead of intercepting network traffic:
```
App Runtime → OkHttp → (hook here) → TLS → Network
```

Instead of:
```
TLS → Network → Proxy
```


---

## Example Flow
```
POST /GenerateAttestationNonce
  → nonce: 698b1f52-...

Play Integrity Call
  → nonce = Base64(SHA256(attestation_object))

POST /GenerateAttestationTokenV2
  → signed_attestation_object

Response:
  → X-Attest-Token (JWT)

Usage:
  → Header injected into all subsequent requests

```
---
## Verification

The nonce derivation can be independently verified:

```bash
python verify_nonce.py
```

---

## Article

Full write-up: https://berkdede.medium.com/breaking-the-black-box-reverse-engineering-twitters-play-integrity-attestation-pipeline-d3dbd2cf37ae

---

## Disclaimer

This project is for educational and research purposes only.  
Do not use it against systems you do not own or have permission to test.

---

## Final Note

This is not just a script.  
It is a research companion to the write-up.

Modern mobile security is not about hiding data in transit it is about controlling where that data can be observed.

If your proxy sees nothing,  
you are probably looking at the wrong layer.
