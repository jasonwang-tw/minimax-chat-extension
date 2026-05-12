const allowBtn = document.getElementById('allowBtn');
const statusEl = document.getElementById('status');

function sendResult(success, error = '') {
  chrome.runtime.sendMessage({
    type: 'LESSON_MIC_PERMISSION_RESULT',
    success,
    error
  }).catch(() => {});
}

async function requestMicrophone() {
  allowBtn.disabled = true;
  statusEl.classList.remove('error');
  statusEl.textContent = '正在要求 Chrome 麥克風權限...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    statusEl.textContent = '麥克風已允許，請回到側邊欄開始錄音。';
    sendResult(true);
    setTimeout(() => window.close(), 900);
  } catch (err) {
    const message = err?.message || '使用者未允許麥克風';
    statusEl.classList.add('error');
    statusEl.textContent = `授權失敗：${message}`;
    allowBtn.disabled = false;
    sendResult(false, message);
  }
}

allowBtn.addEventListener('click', requestMicrophone);
