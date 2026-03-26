'use strict';

Java.perform(function() {

    var JString = Java.use("java.lang.String");
    var JLong   = Java.use("java.lang.Long");
    var ByteArrayInputStream = Java.use("java.io.ByteArrayInputStream");
    var GZIPInputStream      = Java.use("java.util.zip.GZIPInputStream");
    var InputStreamReader    = Java.use("java.io.InputStreamReader");
    var BufferedReader       = Java.use("java.io.BufferedReader");
    var SB = Java.use("java.lang.StringBuilder");

    function logChunked(s, max) {
        var str = String(s); max = max || 8000;
        for (var i = 0; i < Math.min(str.length, max); i += 500)
            console.log("  " + str.substring(i, Math.min(i + 500, str.length)));
    }

    function hexDump(arr, maxLen) {
        var len = Math.min(arr.length, maxLen || 256);
        var hex = "", ascii = "";
        for (var h = 0; h < len; h++) {
            var b = arr[h] & 0xFF;
            var bh = b.toString(16);
            hex += (bh.length === 1 ? "0" : "") + bh + " ";
            ascii += (b >= 32 && b < 127) ? String.fromCharCode(b) : ".";
            if ((h + 1) % 32 === 0) {
                console.log("    " + hex + " |" + ascii + "|");
                hex = ""; ascii = "";
            }
        }
        if (hex) console.log("    " + hex + " |" + ascii + "|");
        if (arr.length > len) console.log("    ... +" + (arr.length - len) + " more bytes");
    }

    function decodeGzip(bytes) {
        try {
            var bais = ByteArrayInputStream.$new(bytes);
            var gzis = GZIPInputStream.$new(bais);
            var reader = BufferedReader.$new(InputStreamReader.$new(gzis, "UTF-8"));
            var sb = SB.$new(); var line = reader.readLine();
            while (line !== null) { sb.append(line); line = reader.readLine(); }
            reader.close(); return sb.toString();
        } catch(e) { return null; }
    }

    // --- Binder IPC ---

    var BINDER_TARGETS = [
        "IExpressIntegrityService",
        "com.google.android.play.core.integrity"
    ];

    function isBinderTarget(desc) {
        if (!desc) return false;
        var d = String(desc);
        for (var i = 0; i < BINDER_TARGETS.length; i++)
            if (d.indexOf(BINDER_TARGETS[i]) !== -1) return true;
        return false;
    }

    try {
        var BinderProxy = Java.use("android.os.BinderProxy");
        BinderProxy.transact.implementation = function(code, data, reply, flags) {
            var desc = "";
            try { desc = this.getInterfaceDescriptor(); } catch(e) {}

            if (isBinderTarget(desc)) {
                console.log("\n[Binder IPC] Code=" + code + " Target=" + desc);
                console.log("  flags=" + flags + " dataSize=" + data.dataSize());
                try {
                    var pos = data.dataPosition();
                    data.setDataPosition(0);
                    var raw = data.marshall();
                    if (raw && raw.length > 0) {
                        console.log("  Request Parcel (" + raw.length + " bytes):");
                        hexDump(raw, 256);
                    }
                    data.setDataPosition(pos);
                } catch(e) { console.log("  parcel err: " + e.message); }
            }

            var ret = this.transact(code, data, reply, flags);

            if (isBinderTarget(desc) && reply) {
                try {
                    var rs = reply.dataSize();
                    if (rs > 0) {
                        var rp = reply.dataPosition();
                        reply.setDataPosition(0);
                        var rraw = reply.marshall();
                        if (rraw && rraw.length > 0) {
                            console.log("  Reply Parcel (" + rraw.length + " bytes):");
                            hexDump(rraw, 512);
                            try {
                                var rStr = JString.$new(rraw, "UTF-8");
                                var readable = String(rStr).replace(/[^\x20-\x7E]/g, '');
                                if (readable.length > 50) {
                                    console.log("  Reply readable (" + readable.length + " chars):");
                                    logChunked(readable, 2000);
                                }
                            } catch(e2) {}
                        }
                        reply.setDataPosition(rp);
                    }
                } catch(e) {}
            }
            return ret;
        };
    } catch(e) { console.log("BinderProxy err: " + e.message); }

    // --- Bundle ---

    try {
        var Bundle = Java.use("android.os.Bundle");
        Bundle.putString.implementation = function(key, value) {
            if (key && value) {
                var k = String(key), v = String(value);
                if (k.indexOf("nonce") !== -1 || k.indexOf("package") !== -1 ||
                    k.indexOf("cloud") !== -1 || v.indexOf("49625052041") !== -1 ||
                    k.indexOf("playcore") !== -1 || k.indexOf("integrity") !== -1 ||
                    k.indexOf("webview") !== -1)
                    console.log("[Bundle] " + k + " = " + v);
            }
            return this.putString(key, value);
        };
        Bundle.putLong.implementation = function(key, value) {
            if (key) {
                var k = String(key);
                if (k.indexOf("cloud") !== -1 || k.indexOf("prj") !== -1 ||
                    k.indexOf("session") !== -1 || k.indexOf("warm") !== -1 ||
                    k.indexOf("sid") !== -1)
                    console.log("[Bundle] " + k + " = " + value);
            }
            return this.putLong(key, value);
        };
        Bundle.putInt.implementation = function(key, value) {
            if (key) {
                var k = String(key);
                if (k.indexOf("version") !== -1 || k.indexOf("mode") !== -1 ||
                    k.indexOf("integrity") !== -1 || k.indexOf("playcore") !== -1)
                    console.log("[Bundle] " + k + " = " + value);
            }
            return this.putInt(key, value);
        };
    } catch(e) { console.log("Bundle err: " + e.message); }

    // --- bindService ---

    try {
        var CW = Java.use("android.content.ContextWrapper");
        CW.bindService.overload(
            "android.content.Intent", "android.content.ServiceConnection", "int"
        ).implementation = function(intent, conn, flags) {
            var action = intent.getAction();
            if (action && String(action).indexOf("integrity") !== -1) {
                console.log("\n[bindService] action=" + action);
                console.log("  component=" + intent.getComponent());
                console.log("  flags=" + flags);
            }
            return this.bindService(intent, conn, flags);
        };
    } catch(e) { console.log("bindService err: " + e.message); }

    // --- PlayCore token response + SHA-256 hasher ---

    var tokenClasses = [
        "com.google.android.play.core.integrity.s",
        "com.google.android.play.core.integrity.af",
        "com.google.android.play.core.integrity.IntegrityTokenResponse"
    ];
    tokenClasses.forEach(function(cn) {
        try {
            var cls = Java.use(cn);
            cls.$init.overload("java.lang.String").implementation = function(tok) {
                console.log("\n[IntegrityToken] from " + cn);
                console.log("  length=" + (tok ? tok.length : 0));
                if (tok) {
                    var t = String(tok);
                    console.log("  token=" + t.substring(0, 300));
                    if (t.length > 300) console.log("  ..." + t.substring(t.length - 100));
                }
                return this.$init(tok);
            };
        } catch(e) {}
    });

    var hasherClasses = [
        "com.google.android.play.core.integrity.j",
        "com.google.android.play.core.integrity.ag"
    ];
    hasherClasses.forEach(function(cn) {
        try {
            var cls = Java.use(cn);
            var meths = cls.class.getDeclaredMethods();
            for (var m = 0; m < meths.length; m++) {
                var mn = meths[m].getName();
                var rt = meths[m].getReturnType().getName();
                if (rt === "java.lang.String" || mn === "b") {
                    (function(name) {
                        try {
                            cls[name].implementation = function() {
                                var r = this[name].apply(this, arguments);
                                console.log("[SHA256 Hasher] " + cn + "." + name + "() = " + r);
                                return r;
                            };
                        } catch(e3) {}
                    })(mn);
                }
            }
        } catch(e) {}
    });

    // --- OkHttp ---

    function dumpHeaders(prefix, headers) {
        try {
            var size = headers.size();
            for (var i = 0; i < size; i++)
                console.log("  " + prefix + headers.name(i) + ": " + headers.value(i));
        } catch(e) {}
    }

    function readBodyBytes(body) {
        try {
            var bc = body.getClass();
            var fA = bc.getDeclaredField("a"); fA.setAccessible(true);
            var entity = fA.get(body);
            if (!entity) return "<null entity>";
            var fs = entity.getClass().getDeclaredFields();
            for (var i = 0; i < fs.length; i++) {
                fs[i].setAccessible(true);
                if (fs[i].getType().getName() === "[B") {
                    var v = fs[i].get(entity);
                    if (v) {
                        var ba = Java.cast(v, Java.use("[B"));
                        return {
                            f: fs[i].getName(), len: ba.length,
                            txt: JString.$new.overload("[B", "java.lang.String").call(JString, ba, "UTF-8")
                        };
                    }
                }
            }
            return "<no byte[]>";
        } catch(e) { return "<err: " + e.message + ">"; }
    }

    function isTarget(url) {
        return url.indexOf("Attestation") !== -1 || url.indexOf("attestation") !== -1 ||
               url.indexOf("onboarding/task") !== -1 || url.indexOf("GenerateAttest") !== -1;
    }

    try {
        var RealCall = Java.use("okhttp3.internal.connection.RealCall");
        RealCall.execute.implementation = function() {
            var req  = this.request();
            var url  = req.url().toString();
            if (isTarget(url)) {
                console.log("\nPOST " + url);
                dumpHeaders("-> ", req.headers());
                try {
                    var body = req.body();
                    if (body) {
                        var r = readBodyBytes(body);
                        if (typeof r === 'object' && r.txt) {
                            console.log("  body [" + r.len + "b, field=" + r.f + "]:");
                            logChunked(r.txt);
                        } else console.log("  body: " + r);
                    }
                } catch(e) { console.log("  body err: " + e.message); }
            }
            var resp = this.execute();
            if (isTarget(url)) {
                console.log("  HTTP " + resp.code());
                dumpHeaders("<- ", resp.headers());
                try {
                    var peek  = resp.peekBody(JLong.parseLong("4194304"));
                    var bytes = peek.bytes();
                    if (bytes && bytes.length > 0) {
                        var dec = decodeGzip(bytes);
                        if (dec) logChunked(dec);
                        else logChunked(JString.$new(bytes, "UTF-8"));
                    }
                } catch(e) {}
            }
            return resp;
        };
        RealCall.enqueue.implementation = function(cb) {
            var url = this.request().url().toString();
            if (isTarget(url)) console.log("ASYNC POST " + url);
            this.enqueue(cb);
        };
    } catch(e) { console.log("RealCall err: " + e.message); }

    // --- PlayCore log messages ---

    try {
        var Log = Java.use("android.util.Log");
        Log.i.overload("java.lang.String", "java.lang.String").implementation = function(t, m) {
            if (m && (m.indexOf("Integrity") !== -1 || m.indexOf("Attestation") !== -1 ||
                       m.indexOf("PlayCore") !== -1))
                console.log("PlayCore: " + t + " " + m);
            return this.i(t, m);
        };
    } catch(e) {}

});
