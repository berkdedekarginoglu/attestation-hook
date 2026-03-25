'use strict';

Java.perform(function () {

    var JString = Java.use("java.lang.String");
    var JLong = Java.use("java.lang.Long");
    var ByteArrayInputStream = Java.use("java.io.ByteArrayInputStream");
    var GZIPInputStream = Java.use("java.util.zip.GZIPInputStream");
    var InputStreamReader = Java.use("java.io.InputStreamReader");
    var BufferedReader = Java.use("java.io.BufferedReader");
    var StringBuilder = Java.use("java.lang.StringBuilder");

    function logChunked(s, max) {
        var str = String(s); max = max || 8000;
        for (var i = 0; i < Math.min(str.length, max); i += 500)
            console.log(str.substring(i, Math.min(i + 500, str.length)));
    }

    function decodeGzip(bytes) {
        try {
            var bais = ByteArrayInputStream.$new(bytes);
            var gzis = GZIPInputStream.$new(bais);
            var reader = BufferedReader.$new(InputStreamReader.$new(gzis, "UTF-8"));
            var sb = StringBuilder.$new();
            var line = reader.readLine();
            while (line !== null) {
                sb.append(line);
                line = reader.readLine();
            }
            reader.close();
            return sb.toString();
        } catch (e) {
            return null;
        }
    }

    function dumpHeaders(headers) {
        try {
            var size = headers.size();
            for (var i = 0; i < size; i++)
                console.log(headers.name(i) + ": " + headers.value(i));
        } catch (e) {}
    }

    function readBodyBytes(body) {
        try {
            var bodyClass = body.getClass();
            var fieldA = bodyClass.getDeclaredField("a");
            fieldA.setAccessible(true);
            var entity = fieldA.get(body);

            if (!entity) return null;

            var entityClass = entity.getClass();
            var fields = entityClass.getDeclaredFields();

            for (var i = 0; i < fields.length; i++) {
                fields[i].setAccessible(true);

                if (fields[i].getType().getName() === "[B") {
                    var val = fields[i].get(entity);
                    if (val !== null) {
                        var byteArr = Java.cast(val, Java.use("[B"));
                        return JString.$new(byteArr, "UTF-8");
                    }
                }
            }

            var superClass = entityClass.getSuperclass();
            if (superClass) {
                var superFields = superClass.getDeclaredFields();
                for (var j = 0; j < superFields.length; j++) {
                    superFields[j].setAccessible(true);

                    if (superFields[j].getType().getName() === "[B") {
                        var sval = superFields[j].get(entity);
                        if (sval !== null) {
                            var sByteArr = Java.cast(sval, Java.use("[B"));
                            return JString.$new(sByteArr, "UTF-8");
                        }
                    }
                }
            }

            return null;
        } catch (e) {
            return null;
        }
    }

    function isTarget(url) {
        return url.indexOf("Attestation") !== -1 ||
               url.indexOf("attestation") !== -1 ||
               url.indexOf("GenerateAttest") !== -1;
    }

    var RealCall = Java.use("okhttp3.internal.connection.RealCall");

    RealCall.execute.implementation = function () {
        var req = this.request();
        var url = req.url().toString();

        if (isTarget(url)) {
            console.log("\n=== REQUEST ===");
            console.log(req.method() + " " + url);
            dumpHeaders(req.headers());

            try {
                var body = req.body();
                if (body) {
                    var text = readBodyBytes(body);
                    if (text) {
                        console.log("\n--- BODY ---");
                        logChunked(text);
                    }
                }
            } catch (e) {}
        }

        var resp = this.execute();

        if (isTarget(url)) {
            console.log("\n=== RESPONSE ===");
            console.log("HTTP " + resp.code());
            dumpHeaders(resp.headers());

            try {
                var peek = resp.peekBody(JLong.parseLong("4194304"));
                var bytes = peek.bytes();

                if (bytes && bytes.length > 0) {
                    console.log("\n--- BODY ---");
                    var decoded = decodeGzip(bytes);
                    if (decoded) logChunked(decoded);
                    else logChunked(JString.$new(bytes, "UTF-8"));
                }
            } catch (e) {}

            console.log("=== END ===\n");
        }

        return resp;
    };

    RealCall.enqueue.implementation = function (cb) {
        this.enqueue(cb);
    };

    var Log = Java.use("android.util.Log");
    Log.i.overload("java.lang.String", "java.lang.String").implementation = function (t, m) {
        if (m && (m.indexOf("Integrity") !== -1 || m.indexOf("Attestation") !== -1))
            console.log(t + ": " + m);
        return this.i(t, m);
    };
});
