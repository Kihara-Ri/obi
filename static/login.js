// 动态码登录沿用服务端会话，登录后带 hash 回到原来的页面。
const form = document.querySelector('#login-form');
const code = document.querySelector('#code');
const field = document.querySelector('.login-code-field');
const error = document.querySelector('#login-error');
const button = form.querySelector('button.primary');
const spinner = button.querySelector('.spinner');
const btnText = button.querySelector('.btn-text');

code.addEventListener('input', () => {
  error.textContent = '';
  code.removeAttribute('aria-invalid');
  field.classList.remove('shake');
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled) return;
  button.disabled = true;
  button.classList.add('loading');
  button.setAttribute('aria-busy', 'true');
  spinner.hidden = false;
  btnText.hidden = true;
  error.textContent = '';
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.value }),
    });
    if (response.ok) {
      location.replace('/' + location.hash);
      return;
    }
    const detail = await response.json().catch(() => null);
    error.textContent = detail?.error || '暂时无法登录，请重试';
    if (response.status === 400) code.setAttribute('aria-invalid', 'true');
    field.classList.remove('shake');
    void field.offsetWidth;
    field.classList.add('shake');
  } catch {
    error.textContent = '暂时无法连接，请重试';
  } finally {
    button.disabled = false;
    button.classList.remove('loading');
    button.removeAttribute('aria-busy');
    spinner.hidden = true;
    btnText.hidden = false;
  }
});
