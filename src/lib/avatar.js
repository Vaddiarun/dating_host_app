import { profile as profileApi } from '../api/index.js'

/** Presign, upload, and return the final public URL for a profile-photo file — shared by
 * onboarding's ProfileSetup and Settings' EditProfile, the two screens that let a host set
 * their photo. */
export async function uploadAvatar(file) {
  const { uploadUrl, url } = await profileApi.getAvatarUploadUrl(file.type)
  await profileApi.uploadAvatarFile(uploadUrl, file)
  return url
}
