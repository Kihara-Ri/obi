#!/bin/sh
# 生成补丁内容包 Obi-<tag>-web.zip（dist-local 去掉 Pyodide 运行时 + content.json）、.sha256 与 .sig（RSA 签名）。
# 用法：make-web-patch.sh <tag> <输出目录> <keystore> <别名> <store密码> <key密码>
# 签名用与安装包同一把密钥；应用用自己安装包的签名证书验签，所以只有持有密钥的发布才会被接受（D-023）。
set -eu
tag=$1; out=$2; ks=$3; alias=$4; spw=$5; kpw=$6
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
mkdir -p "$out" "$work/site"
cp -R "$root/dist-local/." "$work/site/"
rm -rf "$work/site/local/pyodide"
printf '{"tag":"%s"}\n' "$tag" > "$work/site/content.json"
zip="$out/Obi-$tag-web.zip"
rm -f "$zip"
(cd "$work/site" && zip -qr -X "$zip" .)
keytool -importkeystore -srckeystore "$ks" -srcstorepass "$spw" -srckeypass "$kpw" -srcalias "$alias" \
  -destkeystore "$work/k.p12" -deststoretype PKCS12 -deststorepass "$spw" -destkeypass "$spw" -noprompt >/dev/null 2>&1
openssl pkcs12 -in "$work/k.p12" -passin "pass:$spw" -nocerts -nodes -out "$work/key.pem" 2>/dev/null
openssl dgst -sha256 -sign "$work/key.pem" -out "$zip.sig" "$zip"
(cd "$out" && if command -v sha256sum >/dev/null; then sha256sum "Obi-$tag-web.zip"; else shasum -a 256 "Obi-$tag-web.zip"; fi > "Obi-$tag-web.zip.sha256")
ls -l "$out"/Obi-"$tag"-web.zip*
