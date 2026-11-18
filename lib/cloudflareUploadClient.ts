import * as tus from 'tus-js-client';

const DIRECT_LIMIT = 200 * 1024 * 1024;
const CHUNK_SIZE = 150 * 1024 * 1024;

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
    const direct = options.file.size < DIRECT_LIMIT;
    const res = await fetch(direct ? '/api/cloudflare/direct-upload' : '/api/cloudflare/tus-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.token}`,
      },
      body: JSON.stringify(
        direct
          ? { title: options.title }
          : { title: options.title, fileSize: options.file.size }
      ),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to create upload slot');
    if (aborted) throw new Error('Upload cancelled');

    const uid = String(data.uid || '');
    if (!uid) throw new Error('Failed to create upload slot');
    options.onReady?.(uid);

    if (direct) {
      await postFile(data.uploadURL, options.file, options.onProgress, (request) => {
        xhr = request;
      }, () => aborted);
    } else {
      await patchFile(data.tusUrl, options.file, options.onProgress, (upload) => {
        tusUpload = upload;
      }, () => aborted);
    }

    return uid;
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
  tusUrl: string,
  file: File,
  onProgress: (percent: number) => void,
  capture: (upload: tus.Upload) => void,
  isAborted: () => boolean,
) {
  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      uploadUrl: tusUrl,
      uploadSize: file.size,
      chunkSize: CHUNK_SIZE,
      storeFingerprintForResuming: false,
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 1000, 3000, 5000],
      onProgress(bytesUploaded, bytesTotal) {
        onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess() {
        resolve();
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
