import {deleteObject,getDownloadURL,ref,uploadBytes} from "firebase/storage";
import {storage} from "./firebase";
export async function uploadProfilePhoto(uid:string,file:File){const r=ref(storage,`users/${uid}/profile/${file.name}`);await uploadBytes(r,file,{contentType:file.type});return getDownloadURL(r)}
export async function uploadProgressPhoto(uid:string,file:File){const r=ref(storage,`users/${uid}/progress/${file.name}`);await uploadBytes(r,file,{contentType:file.type});return getDownloadURL(r)}
export async function removeStorageFile(path:string){await deleteObject(ref(storage,path))}
