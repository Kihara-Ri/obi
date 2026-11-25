/*! qrcode-generator 2.0.4
MIT License

Copyright (c) 2009 Kazuhiko Arase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// First-run authenticator pairing uses its own entry so the QR encoder stays off the main app path.
import qrcode from 'qrcode-generator';

const fragment = new URLSearchParams(location.hash.slice(1));
const token = fragment.get('token');
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
// An operator can open the private link in a tab already showing /setup.
window.addEventListener('hashchange', () => {
  if (location.hash) location.reload();
});

const status = document.querySelector<HTMLElement>('#setup-status')!;
const pairing = document.querySelector<HTMLElement>('#setup-pairing')!;
const qr = document.querySelector<HTMLImageElement>('#setup-qr')!;
const keyField = document.querySelector<HTMLElement>('#setup-key')!;
const form = document.querySelector<HTMLFormElement>('#setup-form')!;
const code = document.querySelector<HTMLInputElement>('#setup-code')!;
const button = form.querySelector<HTMLButtonElement>('button')!;
const error = document.querySelector<HTMLElement>('#setup-error')!;
const login = document.querySelector<HTMLAnchorElement>('#setup-login')!;

async function request(code?: string) {
  const response = await fetch(form.action, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    referrerPolicy: 'same-origin',
    body: JSON.stringify({token, code}),
  });
  const data = await response.json().catch(() => null);
  return {status: response.status, ok: response.ok, data};
}

function closePairing(message: string) {
  pairing.hidden = true;
  login.hidden = false;
  qr.removeAttribute('src');
  keyField.textContent = '';
  code.value = '';
  status.textContent = message;
}

async function begin() {
  if (!token) return;
  status.textContent = '正在准备绑定';
  try {
    const result = await request();
    const key = result.data?.key;
    if (!result.ok || typeof key !== 'string' || !/^[A-Z2-7]{32}$/.test(key)) {
      closePairing(result.data?.error || '暂时无法开启绑定，请重试');
      return;
    }
    const label = encodeURIComponent(location.host);
    const barcode = qrcode(0, 'M');
    barcode.addData(`otpauth://totp/Obi:${label}?secret=${key}&issuer=Obi`);
    barcode.make();
    qr.src = barcode.createDataURL(6, 24);
    keyField.textContent = key;
    status.textContent = '用 Google Authenticator 扫码，再输入手机显示的动态码。';
    login.hidden = true;
    pairing.hidden = false;
  } catch {
    closePairing('暂时无法开启绑定，请重新打开私有安装链接。');
  }
}

code.addEventListener('input', () => { error.textContent = ''; });
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled) return;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  error.textContent = '';
  try {
    const result = await request(code.value);
    if (result.ok) {
      closePairing('已完成绑定');
      location.replace('/login');
      return;
    }
    if ([403, 404, 410].includes(result.status)) {
      closePairing(result.data?.error || '首次绑定已关闭');
      return;
    }
    error.textContent = result.data?.error || '暂时无法绑定，请重试';
  } catch {
    error.textContent = '暂时无法连接，请重试';
  } finally {
    button.removeAttribute('aria-busy');
    button.disabled = false;
  }
});

void begin();
