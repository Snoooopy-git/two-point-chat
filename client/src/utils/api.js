// HTTP 请求封装

const BASE_URL = ''; // 同源请求，由 Vite 代理或 Express 托管
let unauthorizedHandler = null;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
}

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

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new ApiError(data.error || '请求失败', response.status);
    if (response.status === 401) unauthorizedHandler?.(error);
    throw error;
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
      body: body ? JSON.stringify(body) : undefined
    });
  },
  put(url, body) {
    return request(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    });
  },
  delete(url) {
    return request(url, { method: 'DELETE' });
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
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new ApiError(data.error || '图片上传失败', response.status);
        if (response.status === 401) unauthorizedHandler?.(error);
        throw error;
      }
      if (typeof data.fileUrl !== 'string') {
        throw new Error('上传响应格式无效');
      }
      return data;
    });
  }
};
