// HTTP 请求封装

const BASE_URL = ''; // 同源请求，由 Vite 代理或 Express 托管

function getToken() {
  return localStorage.getItem('token');
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data;
}

export const api = {
  get(url) {
    return request(url, { method: 'GET' });
  },
  post(url, body) {
    return request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },
  upload(url, formData) {
    const token = getToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // 上传文件时不设置 Content-Type，让浏览器自动设置
    return fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers,
      body: formData
    }).then(res => res.json());
  }
};
