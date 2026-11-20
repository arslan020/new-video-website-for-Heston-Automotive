import * as tus from 'tus-js-client';

const DIRECT_LIMIT = 200 * 1024 * 1024;
// Cloudflare allows 5,242,880 to 209,715,200 bytes, in steps of 256 KiB.
// 50MB chunks were reset before the first progress update, so large files use the minimum size.
const CHUNK_SIZE = 5_242_880;
const STALL_MS = 30_000;

type Options = {
  token: string;
  file: File;
  title: string;
  onProgress: (percent: number) => void;
  onReady?: (uid: string) => void;
};

export function startCloudflareUpload(options: Options) {
  let xhr: XMLHttpRequest | null = null;
  let tusUpload: tus.Upload | null = null;
  let aborted = false;

  const done = (async () => {
    if (options.file.size < DIRECT_LIMIT) {
      const res = await fetch('/api/cloudflare/direct-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.token}`,
        },
        body: JSON.stringify({ title: options.title }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to create upload slot');
      if (aborted) throw new Error('Upload cancelled');

      const uid = String(data.uid || '');
      if (!uid) throw new Error('Failed to create upload slot');
      options.onReady?.(uid);
      await postFile(data.uploadURL, options.file, options.onProgress, (request) => {
        xhr = request;
      }, () => aborted);
      return uid;
    }

    if (aborted) throw new Error('Upload cancelled');
    return patchFile(options, (upload) => {
      tusUpload = upload;
    }, () => aborted);
  })();

  return {
    done,
    abort() {
      aborted = true;
      xhr?.abort();
      tusUpload?.abort();
    },
  };
}

function postFile(
  uploadURL: string,
  file: File,
  onProgress: (percent: number) => void,
  capture: (xhr: XMLHttpRequest) => void,
  isAborted: () => boolean,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    capture(request);
    request.open('POST', uploadURL);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error('Upload failed'));
    };
    request.onerror = () => reject(new Error('Upload failed'));
    request.onabort = () => reject(new Error('Upload cancelled'));
    if (isAborted()) {
      reject(new Error('Upload cancelled'));
      return;
    }
    const body = new FormData();
    body.append('file', file);
    request.send(body);
  });
}

function patchFile(
  options: Options,
  capture: (upload: tus.Upload) => void,
  isAborted: () => boolean,
) {
  return new Promise<string>((resolve, reject) => {
    let uid = '';
    const remember = (value: string | null | undefined) => {
      const next = String(value || '').trim();
      if (!next || uid) return;
      uid = next;
      options.onReady?.(next);
    };

    const upload = new tus.Upload(options.file, {
      endpoint: '/api/cloudflare/tus-create',
      uploadSize: options.file.size,
      chunkSize: CHUNK_SIZE,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000, 30000],
      storeFingerprintForResuming: false,
      removeFingerprintOnSuccess: true,
      metadata: { name: options.title },
      httpStack: new StallStack(),
      onBeforeRequest(req) {
        const url = req.getURL();
        if (url.includes('/api/cloudflare/tus-create')) {
          req.setHeader('Authorization', `Bearer ${options.token}`);
        }
      },
      onAfterResponse(req, res) {
        remember(res.getHeader('stream-media-id'));
        if (!uid) remember(uidFrom(res.getHeader('Location') || req.getURL()));
      },
      onProgress(bytesUploaded, bytesTotal) {
        options.onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess() {
        if (!uid) {
          reject(new Error('Upload finished without a video id'));
          return;
        }
        resolve(uid);
      },
      onError(error) {
        reject(isAborted() ? new Error('Upload cancelled') : error);
      },
    });
    capture(upload);
    if (isAborted()) {
      reject(new Error('Upload cancelled'));
      return;
    }
    upload.start();
  });
}

function uidFrom(value: string) {
  return value.match(/[a-f0-9]{32}/i)?.[0] || '';
}

class StallStack {
  getName() {
    return 'StallStack';
  }

  createRequest(method: string, url: string) {
    return new XhrRequest(method, url);
  }
}

class XhrRequest {
  private xhr = new XMLHttpRequest();
  private headers: Record<string, string> = {};
  private stalled = false;

  constructor(private method: string, private url: string) {
    this.xhr.open(method, url, true);
  }

  getMethod() { return this.method; }
  getURL() { return this.url; }
  setHeader(header: string, value: string) {
    this.xhr.setRequestHeader(header, value);
    this.headers[header] = value;
  }
  getHeader(header: string) { return this.headers[header]; }
  setProgressHandler(handler: (bytesSent: number) => void) {
    this.xhr.upload.onprogress = (event) => {
      this.touch();
      if (event.lengthComputable) handler(event.loaded);
    };
  }
  send(body?: Document | XMLHttpRequestBodyInit | null) {
    let lastByte = Date.now();
    const touch = () => {
      lastByte = Date.now();
    };
    this.touch = touch;
    const timer = window.setInterval(() => {
      if (Date.now() - lastByte < STALL_MS) return;
      this.stalled = true;
      this.xhr.abort();
    }, 5000);

    return new Promise<HttpResponseLike>((resolve, reject) => {
      const finish = () => window.clearInterval(timer);
      this.xhr.onload = () => {
        finish();
        resolve(new XhrResponse(this.xhr));
      };
      this.xhr.onerror = () => {
        finish();
        reject(new Error('Upload connection dropped'));
      };
      this.xhr.onabort = () => {
        finish();
        reject(new Error(this.stalled ? 'Upload connection dropped' : 'Upload cancelled'));
      };
      this.xhr.send(body);
    });
  }
  abort() {
    this.xhr.abort();
    return Promise.resolve();
  }
  getUnderlyingObject() { return this.xhr; }
  private touch() {}
}

class XhrResponse {
  constructor(private xhr: XMLHttpRequest) {}
  getStatus() { return this.xhr.status; }
  getHeader(header: string) { return this.xhr.getResponseHeader(header) || undefined; }
  getBody() { return this.xhr.responseText; }
  getUnderlyingObject() { return this.xhr; }
}

type HttpResponseLike = {
  getStatus: () => number;
  getHeader: (header: string) => string | undefined;
  getBody: () => string;
  getUnderlyingObject: () => unknown;
};
