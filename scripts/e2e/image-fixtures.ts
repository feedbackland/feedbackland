// Identical two-pixel raster samples across the HTTP, browser and restore tests.
export const samples = {
  png: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVQImWP4z8Dwn4EBAAj+Af/KOtJRAAAAAElFTkSuQmCC",
    "base64",
  ),
  gif: Buffer.from(
    "R0lGODlhAgABAIAAAExpcf8AACH5BAUAAAAALAAAAAACAAEAAAICTAoAOw==",
    "base64",
  ),
  webp: Buffer.from(
    "UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoCAAEAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=",
    "base64",
  ),
  jpeg: Buffer.from(
    "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABykX//Z",
    "base64",
  ),
};
export const exifJpeg = Buffer.concat([
  samples.jpeg.subarray(0, 2),
  Buffer.from("ffe1001645786966000049492a0008000000000000000000", "hex"),
  samples.jpeg.subarray(2),
]);
export const boundary = "P06-fixture";
export const disposition =
  'Content-Disposition: form-data; name="file"; filename="image"';
export function multipart(file: Buffer, headers = disposition) {
  return Buffer.concat([
    Buffer.from("--" + boundary + "\r\n" + headers + "\r\n\r\n"),
    file,
    Buffer.from("\r\n--" + boundary + "--\r\n"),
  ]);
}
