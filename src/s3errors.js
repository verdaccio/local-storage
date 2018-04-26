// @flow

function makeError(message: string, code: number, fileCode: ?string): Error {
  const err = new Error(message);
  err.httpCode = code;
  err.code = fileCode;
  return err;
}

export const error503 = makeError('resource temporarily unavailable', 500, 'EAGAIN');
export const error404 = makeError('no such package available', 404, 'ENOENT');
export const error409 = makeError('file exists', 409, 'EEXISTS');

export function convertS3GetError(err) {
  if (err.code === 'NoSuchKey') {
    return error404;
  }
  return err;
}
