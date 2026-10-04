const supportedProfileMedia =
  /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i;

export const getProfileMediaSource = (value?: string) =>
  value && supportedProfileMedia.test(value) ? value : "";
