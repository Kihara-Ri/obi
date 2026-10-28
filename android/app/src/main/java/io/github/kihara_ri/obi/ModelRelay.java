package io.github.kihara_ri.obi;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.security.SecureRandom;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 安卓本机模式的原生模型中继（D-030）。
 *
 * OpenCode 不返回 CORS 头，WebView 里的 Pyodide 无法直连；这里只监听 127.0.0.1，
 * 把 /p/&lt;token&gt;/opencode/inference/... 转发到 https://opencode.ai/inference/...，
 * 补 CORS 与固定的 User-Agent。目标主机、路径、方法、请求体大小与头白名单都是写死的，
 * 不代理任意地址；token 每次启动随机生成，只有本应用的页面知道（经 ObiAndroid.modelRelay()）。
 */
final class ModelRelay {
    private static final String UPSTREAM = "https://opencode.ai/";
    private static final String PREFIX_OK = "inference/";
    private static final int MAX_BODY = 40 * 1024 * 1024;

    private final String token;
    private final ExecutorService workers = Executors.newFixedThreadPool(2);
    private volatile ServerSocket socket;
    private volatile boolean running;
    private volatile String base = "";

    ModelRelay() {
        byte[] bytes = new byte[16];
        new SecureRandom().nextBytes(bytes);
        StringBuilder text = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) text.append(String.format(Locale.ROOT, "%02x", b & 0xff));
        token = text.toString();
    }

    /** 启动成功返回 true；端口占用等失败时 base() 为空，页面会退回「模型接口不可用」。 */
    synchronized boolean start() {
        if (running) return true;
        try {
            ServerSocket server = new ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"));
            socket = server;
            running = true;
            base = "http://127.0.0.1:" + server.getLocalPort() + "/p/" + token + "/opencode";
            Thread accept = new Thread(this::acceptLoop, "obi-model-relay");
            accept.setDaemon(true);
            accept.start();
            return true;
        } catch (IOException | RuntimeException e) {
            close();
            return false;
        }
    }

    String base() { return running ? base : ""; }

    synchronized void close() {
        running = false;
        ServerSocket server = socket;
        socket = null;
        base = "";
        if (server != null) {
            try { server.close(); } catch (IOException ignored) { /* 已关闭 */ }
        }
        workers.shutdownNow();
    }

    private void acceptLoop() {
        while (running) {
            try {
                Socket client = socket.accept();
                workers.execute(() -> handle(client));
            } catch (IOException e) {
                if (running) close();
                return;
            }
        }
    }

    private void handle(Socket client) {
        try (Socket socket = client) {
            socket.setSoTimeout(30_000);
            InputStream in = new BufferedInputStream(socket.getInputStream());
            String requestLine = RelayHttp.readLine(in);
            if (requestLine == null) return;
            String[] parts = requestLine.split(" ");
            if (parts.length < 3) { RelayHttp.send(socket, 400, RelayHttp.json("请求格式无效")); return; }
            String method = parts[0].toUpperCase(Locale.ROOT);
            String target = parts[1];
            Map<String, String> headers = RelayHttp.readHeaders(in);
            if (headers == null) { RelayHttp.send(socket, 431, RelayHttp.json("请求头过大")); return; }
            if (!RelayHttp.ORIGIN.equals(headers.get("Origin"))) {
                RelayHttp.send(socket, 403, RelayHttp.json("来源不允许")); return;
            }
            if ("OPTIONS".equals(method)) { RelayHttp.preflight(socket); return; }
            if (!"GET".equals(method) && !"POST".equals(method)) {
                RelayHttp.send(socket, 405, RelayHttp.json("方法不允许")); return;
            }
            String prefix = "/p/" + token + "/opencode/";
            if (!target.startsWith(prefix)) { RelayHttp.send(socket, 404, RelayHttp.json("接口不存在")); return; }
            String rest = target.substring(prefix.length());
            if (!rest.startsWith(PREFIX_OK) || rest.contains("..") || rest.contains("//") || rest.contains("\\")) {
                RelayHttp.send(socket, 404, RelayHttp.json("接口不存在")); return;
            }
            byte[] body = null;
            if ("POST".equals(method)) {
                int length = RelayHttp.contentLength(headers.get("Content-Length"));
                if (length < 0 || length > MAX_BODY) { RelayHttp.send(socket, 413, RelayHttp.json("请求体过大")); return; }
                body = RelayHttp.readBody(in, length);
                if (body == null) { RelayHttp.send(socket, 400, RelayHttp.json("请求体不完整")); return; }
            }
            forward(socket, method, rest, headers, body);
        } catch (IOException | RuntimeException ignored) {
            // 连接失败、超时、页面取消：不落日志，也不回错误细节
        }
    }

    private void forward(Socket client, String method, String rest, Map<String, String> headers, byte[] body) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(UPSTREAM + rest).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(120_000);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("User-Agent", "Obi-Album-Ledger");
        connection.setRequestProperty("Accept", "application/json");
        copyHeader(headers, connection, "Authorization");
        copyHeader(headers, connection, "Content-Type");
        copyHeader(headers, connection, "X-Opencode-Session");
        if (body != null) {
            connection.setDoOutput(true);
            connection.setFixedLengthStreamingMode(body.length);
            try (OutputStream out = connection.getOutputStream()) { out.write(body); }
        }
        int status = connection.getResponseCode();
        InputStream response = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        byte[] data = response == null ? new byte[0] : RelayHttp.readAll(response, 8 * 1024 * 1024);
        RelayHttp.send(client, status, data, connection.getContentType());
        connection.disconnect();
    }

    private static void copyHeader(Map<String, String> from, HttpURLConnection to, String name) {
        String value = from.get(name);
        if (value != null && !value.isEmpty()) to.setRequestProperty(name, value);
    }
}
