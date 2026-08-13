import {createUserWithEmailAndPassword,onAuthStateChanged,signInWithEmailAndPassword,signInWithPopup,signOut,updateProfile,type User} from "firebase/auth";
import {doc,getDoc,serverTimestamp,setDoc} from "firebase/firestore";
import {auth,db,googleProvider} from "./firebase";
export async function ensureUserDocument(user:User){const r=doc(db,"users",user.uid);const s=await getDoc(r);if(!s.exists())await setDoc(r,{uid:user.uid,email:user.email??"",displayName:user.displayName??"New client",photoURL:user.photoURL??"",role:"client",status:"pending",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});}
export async function registerWithEmail(name:string,email:string,password:string){const c=await createUserWithEmailAndPassword(auth,email,password);if(name)await updateProfile(c.user,{displayName:name});await ensureUserDocument(c.user);return c.user;}
export async function signInWithEmail(email:string,password:string){const c=await signInWithEmailAndPassword(auth,email,password);await ensureUserDocument(c.user);return c.user;}
export async function signInWithGoogle(){const c=await signInWithPopup(auth,googleProvider);await ensureUserDocument(c.user);return c.user;}
export function observeAuth(cb:(u:User|null)=>void){return onAuthStateChanged(auth,cb)}
export async function logout(){await signOut(auth)}
