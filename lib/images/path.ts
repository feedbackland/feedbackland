const path =
  /^\/api\/images\/([\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12})$/;
export function imageId(src: string) {
  return path.exec(src)?.[1].toLowerCase();
}
export function imageUrl(id: string) {
  return "/api/images/" + id;
}
