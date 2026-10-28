package io.github.kihara_ri.obi;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.TreeMap;

/** 本机模型中继的最小 HTTP 读写与 CORS 响应（D-030）；只服务 relay，不做通用服务器。 */
final class RelayHttp {
    static final String ORIGIN = "https://appassets.androidplatform.net";
    static final String ALLOW_HEADERS = "authorization, content-type, x-opencode-session, accept";
    static final int MAX_LINE = 16 * 1024;

    private RelayHttp() {}

    static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream line = new ByteArrayOutputStream();
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\n') {
                byte[] bytes = line.toByteArray();
                int length = bytes.length > 0 && bytes[bytes.length - 1] == '\r' ? bytes.length - 1 : bytes.length;
                return new String(bytes, 0, length, StandardCharsets.ISO_8859_1);
            }
            if (line.size() >= MAX_LINE) throw new IOException("line too long");
            line.write(c);
        }
        return line.size() == 0 ? null : new String(line.toByteArray(), StandardCharsets.ISO_8859_1);
    }

    static Map<String, String> readHeaders(InputStream in) throws IOException {
        Map<String, String> headers = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        int total = 0;
        String line;
        while ((line = readLine(in)) != null && !line.isEmpty()) {
            total += line.length();
            if (total > MAX_LINE) return null;
            int colon = line.indexOf(':');
            if (colon > 0) headers.put(line.substring(0, colon).trim(), line.substring(colon + 1).trim());
        }
        return line == null ? null : headers;
    }

    static int contentLength(String value) {
        if (value == null) return 0;
        try { return Integer.parseInt(value.trim()); } catch (NumberFormatException e) { return -1; }
    }

    static byte[] readBody(InputStream in, int length) throws IOException {
        byte[] body = new byte[length];
        int read = 0;
        while (read < length) {
            int count = in.read(body, read, length - read);
            if (count < 0) return null;
            read += count;
        }
        return body;
    }

    static byte[] readAll(InputStream in, int limit) throws IOException {
        try (InputStream source = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = source.read(buffer)) != -1) {
                if (out.size() + read > limit) throw new IOException("response too large");
                out.write(buffer, 0, read);
            }
            return out.toByteArray();
        }
    }

    static void write(Socket socket, byte[] data) throws IOException {
        OutputStream out = socket.getOutputStream();
        out.write(data);
        out.flush();
    }

    static void send(Socket socket, int status, byte[] body) throws IOException {
        send(socket, status, body, "application/json; charset=utf-8");
    }

    static void send(Socket socket, int status, byte[] body, String type) throws IOException {
        byte[] payload = body == null ? new byte[0] : body;
        String head = "HTTP/1.1 " + status + " " + reason(status) + "\r\n" + cors() +
                "Content-Type: " + (type == null ? "application/octet-stream" : type) + "\r\n" +
                "Cache-Control: no-store\r\n" +
                "Connection: close\r\n" +
                "Content-Length: " + payload.length + "\r\n\r\n";
        write(socket, head.getBytes(StandardCharsets.UTF_8));
        write(socket, payload);
    }

    static void preflight(Socket socket) throws IOException {
        String head = "HTTP/1.1 204 No Content\r\n" + cors() +
                "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
                "Access-Control-Allow-Headers: " + ALLOW_HEADERS + "\r\n" +
                "Access-Control-Allow-Private-Network: true\r\n" +
                "Access-Control-Max-Age: 600\r\n" +
                "Connection: close\r\n" +
                "Content-Length: 0\r\n\r\n";
        write(socket, head.getBytes(StandardCharsets.UTF_8));
    }

    static String cors() {
        return "Access-Control-Allow-Origin: " + ORIGIN + "\r\n" + "Vary: Origin\r\n";
    }

    static byte[] json(String message) {
        return ("{\"error\":\"" + message + "\"}").getBytes(StandardCharsets.UTF_8);
    }

    private static String reason(int status) {
        switch (status) {
            case 200: return "OK";
            case 201: return "Created";
            case 204: return "No Content";
            case 400: return "Bad Request";
            case 401: return "Unauthorized";
            case 403: return "Forbidden";
            case 404: return "Not Found";
            case 405: return "Method Not Allowed";
            case 413: return "Payload Too Large";
            case 429: return "Too Many Requests";
            case 431: return "Request Header Fields Too Large";
            case 500: return "Internal Server Error";
            case 502: return "Bad Gateway";
            default: return "OK";
        }
    }
}
