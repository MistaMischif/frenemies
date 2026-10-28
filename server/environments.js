import { randomUUID } from "node:crypto";
export const DEFAULT_ENVIRONMENT = { id: "default", name: "Neon battlefield", url: null };
export const BUILTIN_ENVIRONMENTS = [DEFAULT_ENVIRONMENT,
 {id:"ruins", name:"C2G · Settlement outskirts", url:"/environments/ruins.svg"},
 {id:"forest", name:"C2G · Woodland clearing", url:"/environments/forest.svg"}];
export function parseEnvironmentUpload(body) {
 const name=String(body.name || "").trim();
 if (!name || name.length>50) throw new Error("Name must be 1–50 characters.");
 const match=/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(body.image || ""));
 if (!match) throw new Error("Choose an image using the upload form.");
 const bytes=Buffer.from(match[1],"base64");
 if(bytes.length>512*1024 || bytes.length<4 || bytes[0]!==255 || bytes[1]!==216 || bytes.at(-2)!==255 || bytes.at(-1)!==217)
  throw new Error("Image must be a JPEG no larger than 512 KB.");
 return {id:randomUUID(), name, image:`data:image/jpeg;base64,${bytes.toString("base64")}`};
}
export function environmentList(room) {
 return [...BUILTIN_ENVIRONMENTS, ...room.environmentAssets.map(({id,name})=>({id,name,url:`/environment/${room.overlay}/${id}`}))];
}
